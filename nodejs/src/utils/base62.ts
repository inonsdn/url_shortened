import { randomInt } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_CODE_LENGTH = 10
const MIN_CODE_LENGTH = 6

export function randomCode( length: number ): string {
    const ranRes: string[] = []
    if (length > MAX_CODE_LENGTH) {
        throw new Error(`length must not over ${MAX_CODE_LENGTH}`)
    }
    if (length < MIN_CODE_LENGTH) {
        throw new Error(`length must over ${MIN_CODE_LENGTH}`)
    }
    
    const len = ALPHABET.length
    for (let i = 0; i < length; i++) {
        const ranIdx = randomInt(len)
        const char = ALPHABET.charAt(ranIdx)
        ranRes.push(char)
    }
    return ranRes.join("")
}

export function validateCode( code: string ): boolean {
    // verify all letters in code must be in ALPHABET to meet the base62 code
    if (code.length > MAX_CODE_LENGTH) {
        return false
    }
    if (code.length < MIN_CODE_LENGTH) {
        return false
    }
    for (let i = 0; i < code.length; i++) {
        const char = code[i]
        if (char === undefined) {
            continue
        }
        if (!ALPHABET.includes(char)) {
            return false
        }
    }
    return true
}