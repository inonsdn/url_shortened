import { randomInt } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function randomCode( length: number ): string {
    const ranRes: string[] = []
    const len = ALPHABET.length
    for (let i = 0; i < length; i++) {
        const ranIdx = randomInt(len)
        const char = ALPHABET.charAt(ranIdx)
        ranRes.push(char)
    }
    return ranRes.join("")
}