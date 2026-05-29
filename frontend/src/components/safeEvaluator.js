/**
 * safeEvaluator - a tiny safe arithmetic evaluator for author-supplied formulas.
 *
 * Supports: + - * / ^ (right-assoc power), unary minus/plus, parentheses, the
 * functions sqrt / sin / cos, numeric literals, and named variables supplied via
 * a scope object. No identifier outside {sqrt,sin,cos} ∪ scope is allowed, so
 * there is no path to globals, member access, or function construction. This is a
 * hand-written recursive-descent parser over a small token list - nothing is ever
 * passed to eval or the Function constructor.
 *
 * Used by ParameterExplorer to evaluate MDX-authored output expressions. Kept in
 * its own (non-component) module so the component file exports only components
 * (react-refresh requirement).
 */

const FUNCTIONS = {
    sqrt: Math.sqrt,
    sin: Math.sin,
    cos: Math.cos,
}

function tokenize(input) {
    const tokens = []
    const src = String(input)
    let i = 0
    while (i < src.length) {
        const ch = src[i]
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
            i += 1
            continue
        }
        if ('+-*/^()'.includes(ch)) {
            tokens.push({ type: 'op', value: ch })
            i += 1
            continue
        }
        if ((ch >= '0' && ch <= '9') || ch === '.') {
            let num = ''
            while (i < src.length && ((src[i] >= '0' && src[i] <= '9') || src[i] === '.')) {
                num += src[i]
                i += 1
            }
            const value = Number(num)
            if (!Number.isFinite(value)) {
                throw new Error(`Invalid number "${num}"`)
            }
            tokens.push({ type: 'num', value })
            continue
        }
        if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
            let name = ''
            while (
                i < src.length &&
                ((src[i] >= 'a' && src[i] <= 'z') ||
                    (src[i] >= 'A' && src[i] <= 'Z') ||
                    (src[i] >= '0' && src[i] <= '9') ||
                    src[i] === '_')
            ) {
                name += src[i]
                i += 1
            }
            tokens.push({ type: 'ident', value: name })
            continue
        }
        throw new Error(`Unexpected character "${ch}"`)
    }
    return tokens
}

/**
 * Evaluate an arithmetic expression string against a variable scope.
 * Returns a finite number or throws. Pure: no side effects, no globals.
 */
export function evaluateExpression(expr, scope = {}) {
    const tokens = tokenize(expr)
    let pos = 0

    const peek = () => tokens[pos]
    const next = () => tokens[pos++]
    const expect = (value) => {
        const token = next()
        if (!token || token.value !== value) {
            throw new Error(`Expected "${value}"`)
        }
    }

    // expression := term (('+' | '-') term)*
    function parseExpression() {
        let left = parseTerm()
        let token = peek()
        while (token && token.type === 'op' && (token.value === '+' || token.value === '-')) {
            next()
            const right = parseTerm()
            left = token.value === '+' ? left + right : left - right
            token = peek()
        }
        return left
    }

    // term := factor (('*' | '/') factor)*
    function parseTerm() {
        let left = parseFactor()
        let token = peek()
        while (token && token.type === 'op' && (token.value === '*' || token.value === '/')) {
            next()
            const right = parseFactor()
            left = token.value === '*' ? left * right : left / right
            token = peek()
        }
        return left
    }

    // factor := power ('^' factor)?   (right associative)
    function parseFactor() {
        const base = parsePower()
        const token = peek()
        if (token && token.type === 'op' && token.value === '^') {
            next()
            const exponent = parseFactor()
            return base ** exponent
        }
        return base
    }

    // power := ('-' power) | ('+' power) | primary
    function parsePower() {
        const token = peek()
        if (token && token.type === 'op' && token.value === '-') {
            next()
            return -parsePower()
        }
        if (token && token.type === 'op' && token.value === '+') {
            next()
            return parsePower()
        }
        return parsePrimary()
    }

    // primary := number | ident | func '(' expression ')' | '(' expression ')'
    function parsePrimary() {
        const token = next()
        if (!token) {
            throw new Error('Unexpected end of expression')
        }
        if (token.type === 'num') {
            return token.value
        }
        if (token.type === 'op' && token.value === '(') {
            const value = parseExpression()
            expect(')')
            return value
        }
        if (token.type === 'ident') {
            const after = peek()
            if (after && after.type === 'op' && after.value === '(') {
                const fn = FUNCTIONS[token.value]
                if (!fn) {
                    throw new Error(`Unknown function "${token.value}"`)
                }
                next() // consume '('
                const arg = parseExpression()
                expect(')')
                return fn(arg)
            }
            if (Object.prototype.hasOwnProperty.call(scope, token.value)) {
                return scope[token.value]
            }
            throw new Error(`Unknown variable "${token.value}"`)
        }
        throw new Error(`Unexpected token "${token.value}"`)
    }

    const result = parseExpression()
    if (pos !== tokens.length) {
        throw new Error('Unexpected trailing tokens')
    }
    if (!Number.isFinite(result)) {
        throw new Error('Result is not a finite number')
    }
    return result
}
