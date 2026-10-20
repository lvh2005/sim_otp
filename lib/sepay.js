export const SEPAY_DEPOSIT_SCRIPT = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
if redis.call('HEXISTS', KEYS[1], 'id') == 0 then return -1 end
local amount = tonumber(ARGV[1])
if not amount or amount <= 0 then return -2 end
local balance = redis.call('HINCRBY', KEYS[1], 'balance', amount)
redis.call('HSET', KEYS[3], 'id', ARGV[2], 'user_id', ARGV[3], 'username', ARGV[4], 'type', 'SEPAY_DEPOSIT', 'amount', amount, 'balance', balance, 'reason', 'Nạp tiền tự động qua chuyển khoản', 'createdAt', ARGV[5], 'reference', ARGV[6])
redis.call('ZADD', KEYS[4], ARGV[5], ARGV[2])
redis.call('ZADD', KEYS[5], ARGV[5], ARGV[2])
redis.call('ZADD', KEYS[6], ARGV[5], ARGV[2])
redis.call('ZADD', KEYS[7], ARGV[5], ARGV[2])
redis.call('SET', KEYS[2], ARGV[2])
return balance
`;

import { removeVietnameseAccents } from "./vietnamese-name";

export function extractDepositCode(payload) {
	const matches = new Set();
	const fields = [payload?.code, payload?.content, payload?.description, payload?.orderCode, payload?.referenceCode];
	for (const value of fields) {
		if (!value) continue;
		for (const match of String(value).matchAll(/(?:^|[^A-Z0-9])(SOTP[A-Z0-9]{6,16})(?![A-Z0-9])/gi)) {
			matches.add(match[1].toUpperCase());
		}
	}
	return matches.size === 1 ? [...matches][0] : null;
}

export async function resolveDepositUserId(payload, redis) {
	const fields = [
		payload?.code,
		payload?.content,
		payload?.description,
		payload?.orderCode,
		payload?.referenceCode,
	];
	const rawTexts = fields.filter(Boolean).map(String);
	if (!rawTexts.length) return null;

	// 1. Check legacy SOTP code
	for (const val of rawTexts) {
		for (const match of val.matchAll(/(?:^|[^A-Z0-9])(SOTP[A-Z0-9]{6,16})(?![A-Z0-9])/gi)) {
			const candidate = match[1].toUpperCase();
			const userId = await redis.hget("users:by-deposit-code", candidate);
			if (typeof userId === "string" && userId) return userId;
		}
	}

	// 2. Check for [NAME] before chuyen tien / chuyen tie / chuyen
	for (const val of rawTexts) {
		const clean = removeVietnameseAccents(val).toUpperCase();

		// Match CHUYEN TIEN, CHUYEN TIE, CHUYENTIEN, CHUYEN
		const chuyenMatch = clean.search(/\bCHUYEN(?:\s*TIE[N\.]*|\s*TIEN|\s*TIE|\s*TI)?\b|CHUYENTIEN|CHUYENTIE/i);
		if (chuyenMatch !== -1) {
			const beforePart = clean.substring(0, chuyenMatch).trim();
			const words = beforePart.split(/[^A-Z0-9]+/).filter(Boolean);
			for (let len = Math.min(words.length, 6); len >= 1; len--) {
				const candidateName = words.slice(words.length - len).join(" ");
				const testCodes = [
					candidateName,
					`${candidateName} chuyen tien`,
					`${candidateName} CHUYEN TIEN`,
					`${candidateName.replace(/\s+/g, "")}CHUYENTIEN`,
				];
				for (const code of testCodes) {
					const userId = await redis.hget("users:by-deposit-code", code) || await redis.hget("users:by-fullname", code);
					if (typeof userId === "string" && userId) return userId;
				}
			}
		}

		// 3. Fallback: Check all word n-grams against users:by-fullname and users:by-deposit-code
		const allWords = clean.split(/[^A-Z0-9]+/).filter(Boolean);
		for (let len = Math.min(allWords.length, 5); len >= 2; len--) {
			for (let start = 0; start <= allWords.length - len; start++) {
				const phrase = allWords.slice(start, start + len).join(" ");
				// Don't match generic words alone
				if (phrase.includes("CHUYEN") || phrase.includes("TIEN")) continue;
				const uid = await redis.hget("users:by-fullname", phrase)
					|| await redis.hget("users:by-deposit-code", phrase)
					|| await redis.hget("users:by-deposit-code", `${phrase} chuyen tien`);
				if (typeof uid === "string" && uid) return uid;
			}
		}

		// Also check direct match
		const candidateExact = clean.replace(/\s+/g, " ").trim();
		const directMatch = await redis.hget("users:by-deposit-code", candidateExact)
			|| await redis.hget("users:by-fullname", candidateExact);
		if (typeof directMatch === "string" && directMatch) return directMatch;

		// Compact match
		const compact = clean.replace(/[^A-Z0-9]/g, "");
		const compactMatch = await redis.hget("users:by-deposit-code", compact);
		if (typeof compactMatch === "string" && compactMatch) return compactMatch;
	}

	return null;
}

export function getMinimumDeposit() {
	const amount = Number(process.env.SEPAY_MIN_DEPOSIT_VND || 10000);
	return Number.isSafeInteger(amount) && amount > 0 ? amount : 10000;
}

export function getVietQRUrl({ bankName = "TPBank", accountNumber = "10005790882", accountName = "LE VU HA", amount = 0, depositCode = "" } = {}) {
	const cleanBank = encodeURIComponent(String(bankName || "TPBank").trim());
	const cleanAcc = encodeURIComponent(String(accountNumber || "10005790882").trim());
	const cleanName = encodeURIComponent(String(accountName || "LE VU HA").trim());
	const cleanDes = encodeURIComponent(String(depositCode || "").trim());
	const numAmount = Number(amount);
	const amountParam = Number.isFinite(numAmount) && numAmount > 0 ? `&amount=${Math.round(numAmount)}` : "";
	return `https://img.vietqr.io/image/${cleanBank}-${cleanAcc}-compact2.png?accountName=${cleanName}&addInfo=${cleanDes}${amountParam}`;
}

