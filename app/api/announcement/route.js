import { getAnnouncementConfig, getRedis } from "@/lib/sim-store";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const redis = getRedis();
		const announcement = await getAnnouncementConfig(redis);
		return Response.json(announcement, {
			headers: {
				"Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
			},
		});
	} catch (error) {
		return Response.json({
			enabled: false,
			error: error.message || "Failed to load announcement",
		}, { status: 200 });
	}
}
