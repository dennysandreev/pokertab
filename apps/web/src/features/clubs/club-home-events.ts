import { useEffect, useState } from "react";
import { getClubEvents } from "@/lib/api";
import { useSession } from "@/session/session-context";
import { useClubsList } from "./club-data";
import type { ClubEventListItemDto, ClubEventType, ClubSummaryDto } from "./types";

export type ClubHomeEventItem = {
  club: ClubSummaryDto;
  event: ClubEventListItemDto;
};

type ClubHomeEventsState =
  | {
      status: "idle" | "loading";
      events: ClubHomeEventItem[];
      errorMessage: null;
    }
  | {
      status: "ready";
      events: ClubHomeEventItem[];
      errorMessage: null;
    }
  | {
      status: "error";
      events: ClubHomeEventItem[];
      errorMessage: string;
    };

const EMPTY_CLUBS: ClubSummaryDto[] = [];

export function useUpcomingClubEvents(eventType: ClubEventType): ClubHomeEventsState {
  const { state } = useSession();
  const { clubsState } = useClubsList();
  const clubs = clubsState.data?.clubs ?? EMPTY_CLUBS;
  const [eventsState, setEventsState] = useState<ClubHomeEventsState>({
    status: "idle",
    events: [],
    errorMessage: null
  });

  useEffect(() => {
    const accessToken = state.accessToken;

    if (!accessToken || clubsState.status !== "ready") {
      setEventsState({
        status: "idle",
        events: [],
        errorMessage: null
      });
      return;
    }

    if (clubs.length === 0) {
      setEventsState({
        status: "ready",
        events: [],
        errorMessage: null
      });
      return;
    }

    let isCancelled = false;

    setEventsState((current) => ({
      status: "loading",
      events: current.events,
      errorMessage: null
    }));

    void Promise.all(
      clubs.map(async (club) => {
        const response = await getClubEvents(accessToken, club.id, {
          status: "upcoming",
          type: "all"
        });

        return response.events
          .filter((event) => event.type === eventType)
          .map((event) => ({ club, event }));
      })
    )
      .then((items) => {
        if (isCancelled) {
          return;
        }

        setEventsState({
          status: "ready",
          events: items
            .flat()
            .sort((left, right) => new Date(left.event.scheduledStartAt).getTime() - new Date(right.event.scheduledStartAt).getTime()),
          errorMessage: null
        });
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        setEventsState((current) => ({
          status: "error",
          events: current.events,
          errorMessage: error instanceof Error ? error.message : "Не получилось загрузить ближайшие игры"
        }));
      });

    return () => {
      isCancelled = true;
    };
  }, [clubs, clubsState.status, eventType, state.accessToken]);

  return eventsState;
}
