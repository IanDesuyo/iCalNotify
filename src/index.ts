import ical from 'node-ical';

type Env = {
	CALENDER_URL: string;
	WEBHOOK_URL: string;
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		await this.scheduled({} as ScheduledEvent, env, ctx);
		return new Response('OK');
	},
	// The scheduled handler is invoked at the interval set in our wrangler.toml's
	// [[triggers]] configuration.
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const icsContent = await fetch(env.CALENDER_URL).then((res) => res.text()); //env.CALENDER_URL;
		const data = ical.parseICS(icsContent);

		// Filter events that are happening today, including multi-day events
		const today = new Date(new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Taipei' }));

		const events = Object.values(data).filter((ev: any) => {
			if (ev.type == 'VEVENT') {
				const start = new Date(new Date(ev.start).toLocaleDateString('en-US', { timeZone: 'Asia/Taipei' }));
				const end = new Date(new Date(ev.end || ev.start).toLocaleDateString('en-US', { timeZone: 'Asia/Taipei' }));

				return start <= new Date(today) && end >= new Date(today);
			}
		});

		if (events.length === 0) {
			return;
		}

		// Send a Discord webhook for each event
		const embeds = events.map((ev: any) => {
			const start: Date = ev.start;
			const end: Date = ev.end || start;

			const time = `<t:${Math.floor(start.getTime() / 1000)}:F> - <t:${Math.floor(end.getTime() / 1000)}:F>`;
			const location = ev.location || '世界的某個角落';

			return {
				title: ev.summary,
				description: '',
				fields: [
					{
						name: '⏰️時間',
						value: time,
						inline: true,
					},
					{
						name: '📍地點',
						value: location,
						inline: true,
					},
				],
				footer: {
					text: '黑客社行事曆',
				},
			};
		});

		await fetch(env.WEBHOOK_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				content: `${events.map((ev: any) => ev.summary).join('、')}`,
				embeds,
			}),
		});
	},
};
