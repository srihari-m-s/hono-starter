/**
 * A starter-sized blocklist of the most commonly used passwords.
 *
 * NIST SP 800-63B-4 §3.1.1.2 requires prospective passwords to be compared
 * against a blocklist of "commonly used, expected, or compromised" values, but
 * also notes that an excessively large list has little incremental benefit:
 * the list defends against *online* guessing, which is already throttled by
 * rate limiting. A few hundred entries therefore covers the realistic attack.
 *
 * For full breach-corpus coverage, set `PASSWORD_BREACH_LOOKUP=hibp` to check
 * against Have I Been Pwned's Pwned Passwords range API (see password-policy.ts),
 * or swap this list for a larger one such as the HIBP top 100k or SecLists'
 * `10-million-password-list-top-100000.txt`.
 *
 * Entries are lowercase and compared as whole strings, never as substrings.
 */
const COMMON_PASSWORDS = `
123456 password 12345678 qwerty 123456789 12345 1234 111111 1234567 dragon
123123 baseball abc123 football monkey letmein shadow master 666666 qwertyuiop
123321 mustang 1234567890 michael 654321 superman 1qaz2wsx 7777777 121212
000000 qazwsx 123qwe killer trustno1 jordan jennifer zxcvbnm asdfgh hunter
buster soccer harley batman andrew tigger sunshine iloveyou charlie robert
thomas hockey ranger daniel starwars klaster 112233 george computer michelle
jessica pepper 1111 zxcvbn 555555 11111111 131313 freedom 777777 pass maggie
159753 aaaaaa ginger princess joshua cheese amanda summer love ashley 6969
nicole chelsea biteme matthew access yankees 987654321 dallas austin thunder
taylor matrix william corvette hello martin heather secret merlin diamond
1234qwer gfhjkm hammer silver 222222 88888888 anthony justin bailey
q1w2e3r4t5 patrick internet scooter orange 11111 golfer cookie richard
samantha bigdog guitar jackson whatever mickey chicken sparky snoopy maverick
phoenix camaro peanut morgan welcome falcon cowboy ferrari samsung andrea
smokey steelers joseph mercedes dakota arsenal eagles melissa boomer booboo
spider nascar monster tigers yellow xxxxxx 123123123 gateway marina diablo
bulldog qwer1234 compaq purple hardcore banana junior hannah 123654 porsche
lakers iceman money cowboys 987654 london tennis 999999 ncc1701 coffee scooby
0000 miller boston q1w2e3r4 brandon yamaha chester mother forever johnny
edward 333333 oliver redsox player nikita knight fender barney midnight please
brandy chicago badboy iwantu slayer rangers charles angel flower bigdaddy
rabbit wizard jasper enter rachel chris steven winner adidas victoria natasha
1q2w3e4r jasmine winter prince panties marine ghbdtn fishing cocacola casper
james 232323 razz 888888 444444 55555 77777777
admin administrator root guest demo login user default temp temppass newpass
changeme letmein1 welcome1 welcome123 michael1 michael123 shadow1 master1
password1 password123 passw0rd p@ssw0rd password! qwerty123 qwerty1 abc12345
1qaz2wsx3edc 1qazxsw2 zaq12wsx test123 testtest testpass secret123 iloveyou1
iloveyou2 monkey1 dragon1 football1 baseball1 princess1 sunshine1 superman1
trustno1! letmein123 mypassword pass1234 123456a a123456 abcd1234 asdf1234
zxcvbnm123 qwe123 123qweasd admin123 root123 qwertyui asdfghjkl whatever1
qwertyuiop123 qazwsx123 1q2w3e4r5t 1234abcd password12 password1234
letmein12 iloveyou123 princess123 sunshine123 football123 baseball123
monkey123 dragon123 master123 shadow123 michael12 jordan23 liverpool
chelsea1 arsenal1 barcelona realmadrid juventus milan inter
metallica slipknot nirvana greenday linkinpark eminem 50cent tupac blink182
trustno1qq iloveyou! welcome! admin! secret! password@123 abc123! qwerty!
`.trim().split(/\s+/);

/** Exact-match set, used for whole-string comparison. */
export const commonPasswords: ReadonlySet<string> = new Set(COMMON_PASSWORDS);
