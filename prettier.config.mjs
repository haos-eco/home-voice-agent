/** @type {import('prettier').Config} */
const prettierConfig = {
    printWidth: 100,
    tabWidth: 2,
    singleAttributePerLine: true,
    arrowParens: 'avoid',
    bracketSpacing: true,
    trailingComma: 'all',
    singleQuote: true,
    jsxSingleQuote: true,
    semi: false,
    plugins: ['prettier-plugin-organize-imports', 'prettier-plugin-tailwindcss'],
}

export default prettierConfig
