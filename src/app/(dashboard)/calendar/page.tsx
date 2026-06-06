import { CalendarBoard } from "@/components/calendar/calendar-board";
import { getCurrentProfileOrRedirect } from "@/lib/auth/session";
import { serializeEvent } from "@/lib/serializers";
import { getTodayKey, type CalendarView } from "@/lib/dates/taskflow-dates";
import { getCalendarData } from "@/server/services/event.service";

type CalendarPageProps = {
  searchParams: Promise<{
    view?: string;
    date?: string;
  }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const profile = await getCurrentProfileOrRedirect();
  const query = await searchParams;
  const view = (query.view === "month" || query.view === "day" ? query.view : "week") as CalendarView;

  const calendar = await getCalendarData({
    userId: profile.id,
    timezone: profile.timezone,
    view,
    date: query.date,
  });

  return (
    <CalendarBoard
      events={calendar.events.map(serializeEvent)}
      timezone={profile.timezone}
      todayKey={getTodayKey(profile.timezone)}
      view={calendar.view}
      anchorDate={calendar.anchorDate}
      previousDate={calendar.previousDate}
      nextDate={calendar.nextDate}
      range={calendar.range}
    />
  );
}
