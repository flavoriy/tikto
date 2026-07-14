import { CalendarBoard } from "@/components/calendar/calendar-board";
import { getCurrentProfileOrRedirect } from "@/lib/auth/session";
import { getTodayKey } from "@shared/dates/tikto-dates";
import { getCalendarForView } from "@/lib/internal-services/client";

type CalendarPageProps = {
  searchParams: Promise<{
    view?: string;
    date?: string;
  }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const profile = await getCurrentProfileOrRedirect();
  const query = await searchParams;
  const view = query.view === "month" || query.view === "day" ? query.view : "week";

  const calendar = await getCalendarForView({
    view,
    date: query.date,
  });

  return (
    <CalendarBoard
      events={calendar.events}
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