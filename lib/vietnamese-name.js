/**
 * Utility functions for Vietnamese name normalization and validation
 */

export function removeVietnameseAccents(str) {
	if (!str || typeof str !== "string") return "";
	return str
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D");
}

export function normalizeVietnameseName(str) {
	if (!str || typeof str !== "string") return "";
	return removeVietnameseAccents(str)
		.toUpperCase()
		.replace(/[^A-Z\s]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Checks if a string looks like a standard Vietnamese full name:
 * - Letters and spaces only
 * - At least 2 words (Họ + Tên)
 * - Each word has 1-15 letters (usually >= 2 letters, allow 1 for edge cases like 'Y', 'A')
 * - Total length between 3 and 50 characters
 */
export function isValidVietnameseName(name) {
	if (!name || typeof name !== "string") return false;
	const normalized = normalizeVietnameseName(name);
	if (normalized.length < 3 || normalized.length > 50) return false;

	const words = normalized.split(" ");
	if (words.length < 2) return false;

	for (const word of words) {
		if (!/^[A-Z]{1,15}$/.test(word)) return false;
	}

	return true;
}

export function generateDepositCode(fullName) {
	const normalized = normalizeVietnameseName(fullName);
	return `${normalized} chuyen tien`;
}

export function generateCompactDepositCode(fullName) {
	const normalized = normalizeVietnameseName(fullName);
	return `${normalized.replace(/\s+/g, "")}CHUYENTIEN`;
}
