import { forgotPasswordSchema, loginSchema, patchUserSchema, resetPasswordSchema, selectUsersSchema, signUpUsersSchema, } from '@/db/schema/users';
import { notFoundResponseDef, notFoundSchema } from '@/lib/constants';
import { createPrivateRoute } from '@/lib/create-private-route';
import { HttpStatusCodes } from '@/lib/http-status-codes';
import { HttpStatusPhrases } from '@/lib/http-status-phrases';
import { createRoute, z } from '@hono/zod-openapi';
import { jsonContent, jsonContentOneOf, jsonContentRequired, } from 'stoker/openapi/helpers';
import { createErrorSchema, createMessageObjectSchema, IdParamsSchema, } from 'stoker/openapi/schemas';
const tags = ['users'];
export const signUp = createRoute({
    tags: tags,
    method: 'post',
    path: '/users/sign_up',
    request: {
        body: jsonContentRequired(signUpUsersSchema, 'users signUp payload'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(selectUsersSchema, 'created users'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(signUpUsersSchema), 'users signUp error'),
    },
});
export const login = createRoute({
    tags: tags,
    method: 'post',
    path: '/users/login',
    request: {
        body: jsonContentRequired(loginSchema, 'login payload'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(createMessageObjectSchema('Credentials Verified'), 'creds verified'),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(createMessageObjectSchema('Invalid Credentials'), 'Invalid credentials'),
        [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(createMessageObjectSchema(HttpStatusPhrases.INTERNAL_SERVER_ERROR), HttpStatusPhrases.INTERNAL_SERVER_ERROR),
    },
});
export const list = createPrivateRoute({
    tags,
    method: 'get',
    path: '/users',
    responses: {
        [HttpStatusCodes.OK]: jsonContent(z.array(selectUsersSchema), 'users list'),
    },
});
export const getOne = createPrivateRoute({
    tags,
    method: 'get',
    path: '/users/{id}',
    request: {
        params: IdParamsSchema,
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(selectUsersSchema, 'user by id'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(IdParamsSchema), 'Invalid Id error'),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'User not found'),
    },
});
export const patch = createPrivateRoute({
    tags: tags,
    method: 'patch',
    path: '/users/{id}',
    request: {
        params: IdParamsSchema,
        body: jsonContentRequired(patchUserSchema, 'user patch'),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(selectUsersSchema, 'patched user'),
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContentOneOf([createErrorSchema(patchUserSchema), createErrorSchema(IdParamsSchema)], 'user patch error'),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'User not found'),
    },
});
export const remove = createPrivateRoute({
    tags: tags,
    method: 'delete',
    path: '/users/{id}',
    request: {
        params: IdParamsSchema,
    },
    responses: {
        [HttpStatusCodes.NO_CONTENT]: { description: 'User deleted' },
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(IdParamsSchema), 'Invalid Id error'),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, 'User not found'),
    },
});
export const forgotPassword = createRoute({
    tags,
    method: 'post',
    path: '/users/forgot_password',
    request: {
        body: jsonContentRequired(forgotPasswordSchema, 'Valid email that will accept reset link'),
    },
    responses: {
        ...notFoundResponseDef,
        [HttpStatusCodes.OK]: jsonContent(createMessageObjectSchema('Reset link sent to valid email'), 'Reset link sent to valid email'),
    },
});
export const resetPassword = createRoute({
    tags,
    method: 'post',
    path: '/users/reset_password/{slug}',
    request: {
        params: z.object({ slug: z.string() }),
        body: jsonContentRequired(resetPasswordSchema, 'New password'),
    },
    responses: {
        [HttpStatusCodes.FORBIDDEN]: jsonContent(createMessageObjectSchema(HttpStatusPhrases.FORBIDDEN), HttpStatusPhrases.FORBIDDEN),
        [HttpStatusCodes.OK]: jsonContent(createMessageObjectSchema('Password reset success'), 'Password reset success'),
    },
});
