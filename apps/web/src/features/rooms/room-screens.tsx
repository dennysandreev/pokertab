import type { JSX } from "react";
import {
  formatMinorMoney,
  type GetRoomResponseDto,
  type RebuyHistoryItemDto,
  type RoomPlayerDto,
  type SettlementPlayerResultDto,
  type SettlementPreviewResponseDto,
  type SettlementTransferDto
} from "@pokertable/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getActivePlayers, getMyPlayer } from "./room-view";
import type {
  SettlementDraftPlayer,
  SettlementDraftSummary
} from "./settlement-view";

export type RebuyHistoryState = {
  status: "idle" | "loading" | "ready" | "error";
  items: RebuyHistoryItemDto[];
  errorMessage: string | null;
};

type RoomScreenProps = {
  data: GetRoomResponseDto;
};

type WaitingRoomProps = RoomScreenProps & {
  isStarting: boolean;
  canStart: boolean;
  onStart: () => void;
  onCopyInvite: () => void;
  onShareInvite: () => void;
};

type ActiveRoomPlayerProps = RoomScreenProps & {
  canSelfRebuy: boolean;
  selfRebuyHint: string;
  isCreatingSelfRebuy: boolean;
  isLeavingRoom: boolean;
  isReturningToRoom: boolean;
  isHistoryOpen: boolean;
  historyState: RebuyHistoryState;
  onSelfRebuy: () => void;
  onLeaveRoom: () => void;
  onReturnToRoom: () => void;
  onToggleHistory: () => void;
};

type ActiveRoomAdminProps = RoomScreenProps & {
  historyState: RebuyHistoryState;
  isHistoryOpen: boolean;
  isLeavingRoom: boolean;
  isReturningToRoom: boolean;
  addingRebuyForPlayerId: string | null;
  cancellingRebuyId: string | null;
  onAddRebuy: (player: RoomPlayerDto) => void;
  onCancelRebuy: (rebuy: RebuyHistoryItemDto) => void;
  onLeaveRoom: () => void;
  onOpenSettlement: () => void;
  onReturnToRoom: () => void;
  onToggleHistory: () => void;
};

type SettlementInputScreenProps = RoomScreenProps & {
  draftPlayers: SettlementDraftPlayer[];
  summary: SettlementDraftSummary;
  preview: SettlementPreviewResponseDto | null;
  previewErrorMessage: string | null;
  isPreviewCurrent: boolean;
  isPreviewLoading: boolean;
  isPreviewStale: boolean;
  isClosing: boolean;
  canPreview: boolean;
  canClose: boolean;
  onBack: () => void;
  onChangeFinalAmount: (roomPlayerId: string, value: string) => void;
  onPreview: () => void;
  onCloseSettlement: () => void;
};

const cardClassName =
  "glass-card rounded-[1.25rem] border border-white/10 bg-[#1a1a1a]/80 p-4 backdrop-blur-xl";
const secondaryButtonClassName =
  "border border-white/10 bg-[#252525] text-white hover:bg-[#2d2d2d]";
const inputClassName =
  "mt-3 min-h-12 w-full rounded-xl border border-white/10 bg-[#252525] px-4 py-3 text-right text-lg font-semibold text-white outline-none transition placeholder:text-[#8e9192] focus:border-[#4edea3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]";
const metricCardClassName =
  "rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3";
const rowCardClassName =
  "rounded-[1rem] border border-white/10 bg-[#1c1b1b]/90 px-3 py-3";

export function WaitingRoom({
  data,
  isStarting,
  canStart,
  onStart,
  onCopyInvite,
  onShareInvite
}: WaitingRoomProps): JSX.Element {
  const { room, players } = data;
  const inviteCode = room.inviteCode.toUpperCase();

  return (
    <div className="space-y-4">
      <section className={cardClassName}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a0a7ab]">
              <span className="h-2 w-2 rounded-full bg-[#4edea3]" />
              {canStart ? "Все на месте" : "Ожидание игроков"}
            </div>
            <h2 className="mt-3 text-[2rem] font-bold leading-none text-white">{room.title}</h2>
            <p className="mt-3 max-w-[28rem] text-sm leading-6 text-[#c4c7c8]">
              {canStart
                ? "Лобби собрано. Можно запускать игру и сразу открыть закупы."
                : "Как только админ начнет игру, здесь появится активный стол и история ребаев."}
            </p>
          </div>
          <RoleChip role={room.myRole} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric
            label="Ребай"
            value={formatChipsPrimary(getRoomRebuyChips(room))}
            hint={formatChipsMoneyHint(getRoomRebuyChips(room), room.currency, getRoomChipsPerCurrencyUnit(room))}
          />
          <Metric
            label="Вход"
            value={formatChipsPrimary(room.buyInChips)}
          />
          <Metric label="Курс" value={formatChipsRate(room.currency, getRoomChipsPerCurrencyUnit(room))} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <InviteActionCard
          action={
            <Button
              aria-label="Скопировать код"
              className={cn(secondaryButtonClassName, "h-11 w-11 shrink-0 p-0")}
              onClick={onCopyInvite}
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
            </Button>
          }
          icon="password"
          label="Короткий код"
          value={inviteCode}
        />

        <InviteActionCard
          action={
            <Button className={cn(secondaryButtonClassName, "h-11 shrink-0 px-4")} onClick={onShareInvite}>
              <span className="material-symbols-outlined text-[18px]">send</span>
              Пригласить
            </Button>
          }
          icon="share"
          label="Пригласить в комнату"
          value="Откройте мини-приложение и введите код"
        />
      </section>

      <section className={cardClassName}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xl font-semibold text-white">Игроки в лобби</p>
            <p className="mt-1 text-sm text-[#c4c7c8]">Старт доступен только админу.</p>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#4edea3]">
            {room.playersCount} за столом
          </span>
        </div>
        <div className="mt-4 space-y-2">
          {players.map((player) => (
            <PlayerRow key={player.id} player={player} />
          ))}
        </div>
      </section>

      {canStart ? (
        <div className="space-y-3">
          <Button className="w-full" disabled={isStarting} onClick={onStart}>
            <span className="material-symbols-outlined text-[20px]">play_circle</span>
            {isStarting ? "Запускаем игру" : "Начать игру"}
          </Button>
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
            Минимум два игрока для старта
          </p>
        </div>
      ) : (
        <InfoText text="Ждем, пока админ откроет игру." />
      )}
    </div>
  );
}

type InviteActionCardProps = {
  icon: string;
  label: string;
  value: string;
  action: JSX.Element;
};

function InviteActionCard({ icon, label, value, action }: InviteActionCardProps): JSX.Element {
  return (
    <article className={cardClassName}>
      <div className="flex h-full min-h-[9rem] flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
            <span className="material-symbols-outlined text-[18px] text-[#4edea3]">{icon}</span>
            <span className="min-w-0 truncate">{label}</span>
          </div>
          <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[1.05rem] font-bold leading-tight text-white sm:text-[1.375rem]">
            {value}
          </p>
        </div>
        <div className="flex items-end">{action}</div>
      </div>
    </article>
  );
}

export function ActiveRoomPlayer({
  data,
  canSelfRebuy,
  selfRebuyHint,
  isCreatingSelfRebuy,
  isLeavingRoom,
  isReturningToRoom,
  isHistoryOpen,
  historyState,
  onSelfRebuy,
  onLeaveRoom,
  onReturnToRoom,
  onToggleHistory
}: ActiveRoomPlayerProps): JSX.Element {
  const { room, players } = data;
  const activePlayers = getActivePlayers(players);
  const myPlayer = getMyPlayer(players, room.myPlayerId);
  const isMyPlayerLeft = room.myPlayerStatus === "LEFT";

  return (
    <div className="space-y-4">
      <ActiveRoomHeader room={room} title="Игра идет" />

      <section className={`${cardClassName} relative overflow-hidden`}>
        <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-[#4edea3]/10 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
                Ваши закупы
              </p>
              <p className="mt-2 text-[2.5rem] font-bold leading-none text-white">
                {formatChipsPrimary(getPlayerTotalBuyinChips(myPlayer))}
              </p>
              <p className="mt-2 text-sm text-[#c4c7c8]">
                {(myPlayer?.rebuyCount ?? 0).toLocaleString("ru-RU")} ребаев ·{" "}
                {formatChipsMoneyHint(
                  getPlayerTotalBuyinChips(myPlayer),
                  room.currency,
                  getRoomChipsPerCurrencyUnit(room)
                ) ?? "эквивалент появится позже"}
              </p>
            </div>
            <RoleChip role={room.myRole} />
          </div>

          {isMyPlayerLeft ? null : (
            <>
              <Button
                className="w-full"
                disabled={!canSelfRebuy || isCreatingSelfRebuy}
                onClick={onSelfRebuy}
              >
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                {isCreatingSelfRebuy
                  ? "Добавляем ребай"
                  : `Добавить ребай — ${formatChipsPrimary(getRoomRebuyChips(room))}`}
              </Button>
              <p className="text-sm leading-6 text-[#c4c7c8]">{selfRebuyHint}</p>
            </>
          )}
        </div>
      </section>

      <section className={cardClassName}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
            Игроки за столом
          </p>
          <span className="material-symbols-outlined text-[#8e9192]">group</span>
        </div>
        <div className="mt-4 space-y-2">
          {activePlayers.map((player) => (
            <PlayerTotalsRow key={player.id} player={player} currency={room.currency} />
          ))}
        </div>
      </section>

      <HistorySection
        currency={room.currency}
        historyState={historyState}
        isOpen={isHistoryOpen}
        onToggle={onToggleHistory}
      />

      <section className={cardClassName}>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">Ваш статус за столом</p>
          {isMyPlayerLeft ? (
            <>
              <InfoText
                text={`Вы вышли из игры. Сохранено: ${formatChipsPrimary(getPlayerFinalAmountChips(myPlayer))}.`}
              />
              <Button className="w-full" disabled={isReturningToRoom} onClick={onReturnToRoom}>
                <span className="material-symbols-outlined text-[20px]">replay</span>
                {isReturningToRoom ? "Возвращаем за стол" : "Вернуться за стол"}
              </Button>
            </>
          ) : (
            <Button
              className={cn(secondaryButtonClassName, "w-full")}
              disabled={isLeavingRoom}
              onClick={onLeaveRoom}
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              {isLeavingRoom ? "Сохраняем выход" : "Выйти со стола"}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

export function ActiveRoomAdmin({
  data,
  historyState,
  isHistoryOpen,
  isLeavingRoom,
  isReturningToRoom,
  addingRebuyForPlayerId,
  cancellingRebuyId,
  onAddRebuy,
  onCancelRebuy,
  onLeaveRoom,
  onOpenSettlement,
  onReturnToRoom,
  onToggleHistory
}: ActiveRoomAdminProps): JSX.Element {
  const { room, players } = data;
  const activePlayers = getActivePlayers(players);
  const myPlayer = getMyPlayer(players, room.myPlayerId);
  const isMyPlayerLeft = room.myPlayerStatus === "LEFT";

  return (
    <div className="space-y-4">
      <ActiveRoomHeader room={room} title="Режим администратора" badge="LIVE" />

      <section className={cardClassName}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-semibold text-white">Управление игроками</p>
          <RoleChip role={room.myRole} />
        </div>
        <div className="mt-4 space-y-3">
          {activePlayers.map((player) => (
            <article
              key={player.id}
              className={cn(
                rowCardClassName,
                player.id === room.myPlayerId && "border-l-4 border-l-[#4edea3]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {player.displayName}
                    {player.id === room.myPlayerId ? " (вы)" : ""}
                  </p>
                  <p className="mt-1 text-xs text-[#8e9192]">
                    {player.rebuyCount} ребаев · {formatChipsPrimary(getPlayerTotalBuyinChips(player))}
                  </p>
                </div>
                <Button
                  className="h-9 rounded-xl px-3 text-sm"
                  disabled={addingRebuyForPlayerId === player.id}
                  onClick={() => onAddRebuy(player)}
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  {addingRebuyForPlayerId === player.id ? "Добавляем" : "Ребай"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <HistorySection
        cancellingRebuyId={cancellingRebuyId}
        currency={room.currency}
        historyState={historyState}
        isAdmin
        isOpen={isHistoryOpen}
        onCancelRebuy={onCancelRebuy}
        onToggle={onToggleHistory}
      />

      <section className={cardClassName}>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">Ваш статус за столом</p>
          {isMyPlayerLeft ? (
            <>
              <InfoText
                text={`Вы вышли из игры. Сохранено: ${formatChipsPrimary(getPlayerFinalAmountChips(myPlayer))}.`}
              />
              <Button className="w-full" disabled={isReturningToRoom} onClick={onReturnToRoom}>
                <span className="material-symbols-outlined text-[20px]">replay</span>
                {isReturningToRoom ? "Возвращаем за стол" : "Вернуться за стол"}
              </Button>
            </>
          ) : (
            <Button
              className={cn(secondaryButtonClassName, "w-full")}
              disabled={isLeavingRoom}
              onClick={onLeaveRoom}
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              {isLeavingRoom ? "Сохраняем выход" : "Выйти со стола"}
            </Button>
          )}
        </div>
      </section>

      <section className={cardClassName}>
        <div>
          <Button className="w-full" onClick={onOpenSettlement}>
            <span className="material-symbols-outlined text-[18px]">calculate</span>
            К расчету
          </Button>
        </div>
      </section>
    </div>
  );
}

export function SettlementInputScreen({
  data,
  draftPlayers,
  summary,
  preview,
  previewErrorMessage,
  isPreviewCurrent,
  isPreviewLoading,
  isPreviewStale,
  isClosing,
  canPreview,
  canClose,
  onBack,
  onChangeFinalAmount,
  onPreview,
  onCloseSettlement
}: SettlementInputScreenProps): JSX.Element {
  const { room } = data;
  const differenceMessage = getChipsDifferenceMessage(getSummaryDifferenceChips(summary));
  const previewResults = isPreviewCurrent ? preview?.players ?? [] : [];
  const previewTransfers = isPreviewCurrent ? preview?.transfers ?? [] : [];
  const progressPercent = Math.round((getSettlementProgress(draftPlayers) / Math.max(draftPlayers.length, 1)) * 100);

  return (
    <div className="space-y-4">
      <section className={cardClassName}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
              Расчет результатов
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{room.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#c4c7c8]">
              Введите, сколько фишек осталось у каждого игрока за столом. Денежный эквивалент рядом только для ориентира.
            </p>
          </div>
          <Button className={secondaryButtonClassName} onClick={onBack}>
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            К столу
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Metric
            label="Всего закупов"
            value={formatChipsPrimary(getSummaryTotalBuyinsChips(summary))}
            hint={formatChipsMoneyHint(
              getSummaryTotalBuyinsChips(summary),
              room.currency,
              getRoomChipsPerCurrencyUnit(room)
            )}
          />
          <Metric
            label="Введено"
            value={formatChipsPrimary(getSummaryTotalFinalAmountChips(summary))}
            hint={formatChipsMoneyHint(
              getSummaryTotalFinalAmountChips(summary),
              room.currency,
              getRoomChipsPerCurrencyUnit(room)
            )}
          />
          <Metric
            label="Разница"
            value={formatChipsPrimary(getSummaryDifferenceChips(summary))}
            hint={formatChipsMoneyHint(
              getSummaryDifferenceChips(summary),
              room.currency,
              getRoomChipsPerCurrencyUnit(room)
            )}
            tone={!summary.isBalanced ? "error" : "default"}
          />
        </div>
      </section>

      {summary.isBalanced ? (
        <InfoText text="Баланс сошелся. Можно проверить итог и закрыть игру." tone="success" />
      ) : differenceMessage ? (
        <InfoText text={differenceMessage} tone="error" />
      ) : null}

      {summary.hasMissingValues ? (
        <InfoText text="Не у всех игроков заполнена финальная сумма." tone="error" />
      ) : null}

      {summary.hasInvalidValues ? (
        <InfoText
          text="Одна из сумм выглядит неверно. Подойдет формат вроде 7500 или 7500,50."
          tone="error"
        />
      ) : null}

      <section className={cardClassName}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-white">Финальные суммы</p>
            <p className="mt-1 text-sm text-[#c4c7c8]">Введите, сколько фишек осталось у каждого игрока.</p>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#4edea3]">
            {progressPercent}%
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {draftPlayers.map((player) => (
            <article
              key={player.roomPlayerId}
              className={cn(
                rowCardClassName,
                player.roomPlayerId === room.myPlayerId && "border-[#4edea3]/40 bg-[#4edea3]/[0.06]"
              )}
            >
              <div className="flex items-start gap-3">
                <PlayerAvatar name={player.displayName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">{player.displayName}</p>
                    {player.status === "LEFT" ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-[#c4c7c8]">
                        Вышел
                      </span>
                    ) : null}
                    {player.roomPlayerId === room.myPlayerId ? (
                      <span className="rounded-full border border-[#4edea3]/20 bg-[#4edea3]/10 px-2 py-0.5 text-[11px] text-[#4edea3]">
                        Вы
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#8e9192]">
                    Закупы: {formatChipsPrimary(getPlayerTotalBuyinChips(player))}
                  </p>
                  <p className={cn("mt-1 text-xs font-semibold", getNetResultClass(player.netResultChips))}>
                    {player.netResultChips === null
                      ? "Результат появится после ввода"
                      : formatChipsWithMoneySecondary(
                          player.netResultChips,
                          room.currency,
                          getRoomChipsPerCurrencyUnit(room)
                        )}
                  </p>
                </div>
              </div>

              <label className="mt-3 block">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#8e9192]">
                  Финальные фишки
                </span>
                <input
                  className={inputClassName}
                  inputMode="decimal"
                  placeholder="Например, 7 500"
                  value={player.finalAmountInput}
                  onChange={(event) => onChangeFinalAmount(player.roomPlayerId, event.target.value)}
                />
              </label>

              {player.issue ? (
                <p className="mt-2 text-sm text-rose-200">{getSettlementIssueText(player.issue)}</p>
              ) : null}
            </article>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
            <span>Прогресс</span>
            <span className="text-[#4edea3]">{progressPercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#4edea3] transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </section>

      <section className={cardClassName}>
        <div className="space-y-3">
          <Button className="w-full" disabled={!canPreview} onClick={onPreview}>
            <span className="material-symbols-outlined text-[18px]">calculate</span>
            {isPreviewLoading ? "Проверяем расчет" : "Проверить расчет"}
          </Button>
          <Button className="w-full" disabled={!canClose} onClick={onCloseSettlement}>
            <span className="material-symbols-outlined text-[18px]">done_all</span>
            {isClosing ? "Закрываем игру" : "Закрыть игру"}
          </Button>
        </div>

        {previewErrorMessage ? <div className="mt-3"><InfoText text={previewErrorMessage} tone="error" /></div> : null}
        {isPreviewStale ? (
          <div className="mt-3">
            <InfoText text="Суммы изменились. Еще раз проверьте расчет перед закрытием." />
          </div>
        ) : null}
      </section>

      {previewResults.length > 0 ? (
        <ResultsSection
          currency={room.currency}
          currentPlayerId={room.myPlayerId}
          description="Показываем плюс и минус по каждому игроку перед закрытием стола."
          players={previewResults}
          title="Предварительный итог"
        />
      ) : null}

      {isPreviewCurrent && preview?.differenceChips === "0" ? (
        <TransferInstructionsSection
          currency={room.currency}
          chipsPerCurrencyUnit={getRoomChipsPerCurrencyUnit(room)}
          description="Это ручная подсказка после игры. Переводы в приложении не выполняются."
          transfers={previewTransfers}
        />
      ) : null}
    </div>
  );
}

export function ClosedRoomResults({ data }: RoomScreenProps): JSX.Element {
  const { room, players, settlement } = data;
  const fallbackPlayers = buildFallbackResults(players);
  const resultPlayers = settlement?.players ?? fallbackPlayers;
  const myTransfer = settlement
    ? getTransferForPlayer(settlement.transfers, room.myPlayerId)
    : null;

  return (
    <div className="space-y-4">
      <section className={cardClassName}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
          Игра завершена
        </p>
        <h2 className="mt-3 text-[2rem] font-bold leading-none text-white">Итоги сохранены</h2>
        <p className="mt-2 text-sm leading-6 text-[#c4c7c8]">
          {room.title} · {resultPlayers.length} игроков · Общий стол{" "}
          {formatChipsPrimary(getSettlementTotalBuyinsChips(settlement, room))}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric
            label="Ваш итог"
            value={formatChipsPrimary(getMyNetResultChips(resultPlayers, room.myPlayerId, room))}
            hint={formatChipsMoneyHint(
              getMyNetResultChips(resultPlayers, room.myPlayerId, room),
              room.currency,
              getRoomChipsPerCurrencyUnit(room)
            )}
          />
          <Metric
            label="Фишек на финише"
            value={formatChipsPrimary(getSettlementTotalFinalAmountChips(settlement, room, resultPlayers))}
            hint={formatChipsMoneyHint(
              getSettlementTotalFinalAmountChips(settlement, room, resultPlayers),
              room.currency,
              getRoomChipsPerCurrencyUnit(room)
            )}
          />
        </div>
      </section>

      {myTransfer ? (
        <section className="rounded-[1.25rem] border border-[#4edea3]/30 bg-[#4edea3]/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#4edea3]/15 text-[#4edea3]">
              <span className="material-symbols-outlined">
                {myTransfer.direction === "outgoing" ? "north_east" : "south_west"}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Что делать после игры</p>
              <p className="mt-1 text-sm text-[#c4c7c8]">
                {myTransfer.direction === "outgoing"
                  ? `Вам нужно передать ${formatChipsWithMoneySecondary(getTransferAmountChips(myTransfer), room.currency, getRoomChipsPerCurrencyUnit(room))} игроку ${myTransfer.counterpartyName}.`
                  : `Игрок ${myTransfer.counterpartyName} передает вам ${formatChipsWithMoneySecondary(getTransferAmountChips(myTransfer), room.currency, getRoomChipsPerCurrencyUnit(room))}.`}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {settlement ? null : (
        <InfoText text="Подробной инструкции по переводам нет, но финальные суммы игроков сохранены." />
      )}

      <ResultsSection
        currency={room.currency}
        currentPlayerId={room.myPlayerId}
        description="Список отсортирован от лучшего результата к худшему."
        players={resultPlayers}
        title="Итоги игры"
      />

      {settlement ? (
        <TransferInstructionsSection
          currency={room.currency}
          chipsPerCurrencyUnit={getRoomChipsPerCurrencyUnit(room)}
          description="Здесь видно, кому и сколько передать вручную после игры."
          transfers={settlement.transfers}
        />
      ) : null}
    </div>
  );
}

function ActiveRoomHeader({
  room,
  title,
  badge
}: {
  room: GetRoomResponseDto["room"];
  title: string;
  badge?: string;
}): JSX.Element {
  return (
    <section className={`${cardClassName} relative overflow-hidden`}>
      <div className="absolute right-[-2rem] top-[-2rem] h-32 w-32 rounded-full bg-[#4edea3]/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-white">{room.title}</h2>
            <div className="mt-2 flex items-center gap-2 text-sm text-[#c4c7c8]">
              <span className="h-2 w-2 rounded-full bg-[#4edea3]" />
              <span>{title}</span>
              {room.startedAt ? (
                <>
                  <span className="text-white/20">•</span>
                  <span>{formatStartedAt(room.startedAt)}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {badge ? (
              <span className="rounded-full border border-[#4edea3]/20 bg-[#4edea3]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4edea3]">
                {badge}
              </span>
            ) : null}
            <RoleChip role={room.myRole} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-white/5 bg-white/[0.03] p-3 sm:grid-cols-4">
          <CompactMetric
            label="Ребай"
            value={formatChipsPrimary(getRoomRebuyChips(room))}
            hint={formatChipsMoneyHint(getRoomRebuyChips(room), room.currency, getRoomChipsPerCurrencyUnit(room))}
          />
          <CompactMetric
            label="Общий стол"
            value={formatChipsPrimary(getRoomTotalPotChips(room))}
            hint={formatChipsMoneyHint(getRoomTotalPotChips(room), room.currency, getRoomChipsPerCurrencyUnit(room))}
          />
          <CompactMetric label="Курс" value={formatChipsRate(room.currency, getRoomChipsPerCurrencyUnit(room))} />
          <CompactMetric label="Игроков" value={String(room.playersCount)} />
        </div>
      </div>
    </section>
  );
}

function HistorySection({
  currency,
  historyState,
  isOpen,
  isAdmin = false,
  cancellingRebuyId = null,
  onCancelRebuy,
  onToggle
}: {
  currency: string;
  historyState: RebuyHistoryState;
  isOpen: boolean;
  isAdmin?: boolean;
  cancellingRebuyId?: string | null;
  onCancelRebuy?: (rebuy: RebuyHistoryItemDto) => void;
  onToggle: () => void;
}): JSX.Element {
  void currency;
  const activeHistoryItems = historyState.items.filter((item) => item.status === "ACTIVE");
  return (
    <section className={cardClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">История ребаев</h3>
          <p className="mt-1 text-sm text-[#c4c7c8]">Здесь остаются действующие и отмененные записи.</p>
        </div>
        <Button
          className="border border-white/10 bg-transparent text-[#c4c7c8] shadow-none hover:bg-white/[0.04] hover:text-white"
          onClick={onToggle}
        >
          <span className="material-symbols-outlined text-[18px]">history</span>
          {isOpen ? "Скрыть" : "Открыть"}
        </Button>
      </div>

      {isOpen ? (
        <>
          {historyState.status === "ready" && historyState.items.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Всего ребаев" value={String(activeHistoryItems.length)} />
              <Metric
                label="Средний ребай"
                value={formatChipsPrimary(getAverageRebuyChips(activeHistoryItems))}
              />
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {historyState.status === "loading" || historyState.status === "idle" ? (
              <InfoText text="Подтягиваем последние записи..." />
            ) : null}

            {historyState.status === "error" && historyState.errorMessage ? (
              <InfoText text={historyState.errorMessage} tone="error" />
            ) : null}

            {historyState.status === "ready" && historyState.items.length === 0 ? (
              <InfoText text="История пока пустая." />
            ) : null}

            {historyState.items.map((rebuy) => (
              <article
                key={rebuy.id}
                className={cn(
                  rowCardClassName,
                  rebuy.status === "CANCELLED" && "border-dashed border-rose-400/30 opacity-70"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        rebuy.status === "ACTIVE" ? "bg-[#4edea3]/10 text-[#4edea3]" : "bg-white/5 text-rose-200"
                      )}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {rebuy.status === "ACTIVE"
                          ? rebuy.source === "ADMIN_FOR_PLAYER"
                            ? "admin_panel_settings"
                            : "add_circle"
                          : "cancel"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {getRebuyHeadline(rebuy)}
                        </p>
                        <StatusChip status={rebuy.status} />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#8e9192]">
                        {formatEventTime(rebuy.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-semibold",
                      rebuy.status === "ACTIVE" ? "text-[#4edea3]" : "text-[#c4c7c8] line-through"
                    )}
                  >
                    {formatChipsPrimary(getRebuyAmountChips(rebuy))}
                  </p>
                </div>

                {rebuy.status === "CANCELLED" ? (
                  <p className="mt-3 text-xs leading-5 text-[#8e9192]">
                    Отменил {rebuy.cancelledByName ?? "админ"}
                    {rebuy.cancelledAt ? ` · ${formatEventTime(rebuy.cancelledAt)}` : ""}
                    {rebuy.cancellationReason ? ` · ${rebuy.cancellationReason}` : ""}
                  </p>
                ) : null}

                {isAdmin && rebuy.status === "ACTIVE" && onCancelRebuy ? (
                  <div className="mt-3">
                    <Button
                      className="w-full border border-rose-300/20 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15"
                      disabled={cancellingRebuyId === rebuy.id}
                      onClick={() => onCancelRebuy(rebuy)}
                    >
                      <span className="material-symbols-outlined text-[18px]">remove_circle</span>
                      {cancellingRebuyId === rebuy.id ? "Отменяем ребай" : "Отменить ребай"}
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function PlayerRow({ player }: { player: RoomPlayerDto }): JSX.Element {
  return (
    <article className={`${rowCardClassName} flex items-center justify-between gap-3`}>
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar name={player.displayName} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{player.displayName}</p>
          <p className="mt-1 text-xs text-[#8e9192]">{getRoleText(player.role)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#8e9192]">{getPlayerStatusText(player.status)}</span>
        <span className="material-symbols-outlined text-[#4edea3]" style={{ fontVariationSettings: "'FILL' 1" }}>
          check_circle
        </span>
      </div>
    </article>
  );
}

function PlayerTotalsRow({
  player,
  currency
}: {
  player: RoomPlayerDto;
  currency: string;
}): JSX.Element {
  return (
    <article className={`${rowCardClassName} flex items-center justify-between gap-3`}>
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar name={player.displayName} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{player.displayName}</p>
          <p className="mt-1 text-xs text-[#8e9192]">{player.rebuyCount} ребаев</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-white">
          {formatChipsPrimary(getPlayerTotalBuyinChips(player))}
        </p>
        <p className="mt-1 text-xs text-[#8e9192]">
          {formatChipsMoneyHint(getPlayerTotalBuyinChips(player), currency, null) ?? getRoleText(player.role)}
        </p>
      </div>
    </article>
  );
}

function PlayerAvatar({ name }: { name: string }): JSX.Element {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#353434] text-xs font-semibold text-[#c4c7c8]">
      {initials || "?"}
    </div>
  );
}

function RoleChip({ role }: { role: GetRoomResponseDto["room"]["myRole"] }): JSX.Element {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        role === "OWNER" || role === "ADMIN"
          ? "border border-[#4edea3]/20 bg-[#4edea3]/10 text-[#4edea3]"
          : "border border-white/10 bg-white/[0.03] text-[#c4c7c8]"
      )}
    >
      {getRoleText(role)}
    </span>
  );
}

function StatusChip({
  status
}: {
  status: RebuyHistoryItemDto["status"];
}): JSX.Element {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "ACTIVE"
          ? "bg-[#4edea3]/10 text-[#4edea3]"
          : "bg-rose-300/10 text-rose-200"
      )}
    >
      {status === "ACTIVE" ? "Действует" : "Отменен"}
    </span>
  );
}

function CompactMetric({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint?: string | undefined;
}): JSX.Element {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8e9192]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[#8e9192]">{hint}</p> : null}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "default"
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "default" | "error";
}): JSX.Element {
  return (
    <div className={metricCardClassName}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8e9192]">
        {label}
      </p>
      <p className={cn("mt-2 text-sm font-semibold", tone === "error" ? "text-rose-200" : "text-white")}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[#8e9192]">{hint}</p> : null}
    </div>
  );
}

function ResultsSection({
  title,
  description,
  players,
  currency,
  currentPlayerId
}: {
  title: string;
  description: string;
  players: SettlementPlayerResultDto[];
  currency: string;
  currentPlayerId: string;
}): JSX.Element {
  void currency;
  const sortedPlayers = [...players].sort((left, right) => {
    const difference = BigInt(right.netResultChips) - BigInt(left.netResultChips);

    if (difference !== 0n) {
      return difference > 0n ? 1 : -1;
    }

    return left.displayName.localeCompare(right.displayName, "ru");
  });

  return (
    <section className={cardClassName}>
      <div>
        <p className="text-lg font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-[#c4c7c8]">{description}</p>
      </div>

      <div className="mt-4 space-y-3">
        {sortedPlayers.map((player, index) => (
          <article
            key={player.roomPlayerId}
            className={cn(
              rowCardClassName,
              player.roomPlayerId === currentPlayerId && "border-[#4edea3]/30 bg-[#4edea3]/[0.05]"
            )}
          >
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold",
                  index === 0
                    ? "border-[#4edea3]/50 text-[#4edea3]"
                    : "border-white/10 text-[#c4c7c8]"
                )}
              >
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-white">{player.displayName}</p>
                  {player.roomPlayerId === currentPlayerId ? (
                    <span className="text-[11px] font-medium text-[#4edea3]">Вы</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#8e9192]">
                  {formatChipsPrimary(getResultTotalBuyinChips(player))} →{" "}
                  {formatChipsPrimary(getResultFinalAmountChips(player))}
                </p>
              </div>
              <p className={cn("text-right text-lg font-semibold", getNetResultClass(player.netResultChips))}>
                {formatChipsPrimary(getResultNetResultChips(player))}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TransferInstructionsSection({
  transfers,
  currency,
  chipsPerCurrencyUnit,
  description
}: {
  transfers: SettlementTransferDto[];
  currency: string;
  chipsPerCurrencyUnit: number | null;
  description: string;
}): JSX.Element {
  return (
    <section className={cardClassName}>
      <div>
        <p className="text-lg font-semibold text-white">Кто кому переводит</p>
        <p className="mt-1 text-sm text-[#c4c7c8]">{description}</p>
      </div>

      {transfers.length === 0 ? (
        <div className="mt-4">
          <InfoText text="Расчет сошелся без ручных переводов." tone="success" />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {transfers.map((transfer) => (
            <article
              key={`${transfer.fromRoomPlayerId}-${transfer.toRoomPlayerId}-${transfer.amountChips}`}
              className={`${rowCardClassName} flex items-center justify-between gap-3`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-[#8e9192]">От</p>
                  <p className="truncate text-sm font-semibold text-white">{transfer.fromName}</p>
                </div>
                <span className="material-symbols-outlined text-[#4edea3]">arrow_forward</span>
                <div className="min-w-0">
                  <p className="text-xs text-[#8e9192]">Кому</p>
                  <p className="truncate text-sm font-semibold text-white">{transfer.toName}</p>
                </div>
              </div>
              <p className="shrink-0 text-lg font-semibold text-white">
                {formatTransferAmountPrimary(
                  getTransferAmountChips(transfer),
                  currency,
                  chipsPerCurrencyUnit
                )}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function InfoText({
  text,
  tone = "muted"
}: {
  text: string;
  tone?: "muted" | "error" | "success";
}): JSX.Element {
  return (
    <p
      className={cn(
        "rounded-[1rem] border px-3 py-3 text-sm leading-6",
        tone === "error"
          ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
          : tone === "success"
            ? "border-[#4edea3]/20 bg-[#4edea3]/10 text-[#d7ffee]"
            : "border-white/10 bg-white/[0.03] text-[#c4c7c8]"
      )}
    >
      {text}
    </p>
  );
}

function getRoleText(role: RoomPlayerDto["role"]): string {
  switch (role) {
    case "OWNER":
      return "Админ";
    case "ADMIN":
      return "Помогает вести";
    default:
      return "Игрок";
  }
}

function getSettlementIssueText(issue: SettlementDraftPlayer["issue"]): string {
  switch (issue) {
    case "missing":
      return "Здесь еще нет финальной суммы.";
    case "invalid":
      return "Не получилось распознать сумму. Подойдет формат вроде 7500 или 7500,50.";
    case "negative":
      return "Финальная сумма не может быть меньше нуля.";
    default:
      return "";
  }
}

function getPlayerStatusText(status: RoomPlayerDto["status"]): string {
  switch (status) {
    case "LEFT":
      return "Вышел";
    case "REMOVED":
      return "Убран";
    default:
      return "В игре";
  }
}

function getRebuyHeadline(rebuy: RebuyHistoryItemDto): string {
  if (rebuy.status === "CANCELLED") {
    return "Ребай отменен";
  }

  if (rebuy.source === "ADMIN_FOR_PLAYER") {
    return `Админ добавил ребай для ${rebuy.playerName}`;
  }

  return `${rebuy.playerName} добавил ребай`;
}

function formatEventTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function formatStartedAt(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getSettlementProgress(players: SettlementDraftPlayer[]): number {
  return players.filter((player) => player.finalAmountInput.trim() !== "" && player.issue !== "invalid").length;
}

function getNetResultClass(value: string | null): string {
  if (value === null) {
    return "text-[#c4c7c8]";
  }

  const amount = BigInt(value);

  if (amount > 0n) {
    return "text-[#4edea3]";
  }

  if (amount < 0n) {
    return "text-rose-200";
  }

  return "text-white";
}

function buildFallbackResults(players: RoomPlayerDto[]): SettlementPlayerResultDto[] {
  return players
    .filter((player) => player.finalAmountChips !== null)
    .map((player) => ({
      roomPlayerId: player.id,
      displayName: player.displayName,
      totalBuyinChips: player.totalBuyinChips,
      finalAmountChips: player.finalAmountChips ?? "0",
      netResultChips:
        player.netResultChips ??
        (BigInt(player.finalAmountChips ?? "0") - BigInt(player.totalBuyinChips)).toString()
    }));
}

function getTransferForPlayer(
  transfers: SettlementTransferDto[],
  myPlayerId: string
):
  | {
      amountChips: string;
      counterpartyName: string;
      direction: "incoming" | "outgoing";
    }
  | null {
  const outgoing = transfers.find((transfer) => transfer.fromRoomPlayerId === myPlayerId);

  if (outgoing) {
    return {
      amountChips: outgoing.amountChips,
      counterpartyName: outgoing.toName,
      direction: "outgoing"
    };
  }

  const incoming = transfers.find((transfer) => transfer.toRoomPlayerId === myPlayerId);

  if (incoming) {
    return {
      amountChips: incoming.amountChips,
      counterpartyName: incoming.fromName,
      direction: "incoming"
    };
  }

  return null;
}

type ChipsCarrier = {
  buyInChips?: string;
  rebuyChips?: string;
  chipsPerCurrencyUnit?: number;
  totalPotChips?: string;
  myBuyinsChips?: string;
  totalBuyinChips?: string;
  finalAmountChips?: string;
  netResultChips?: string;
  amountChips?: string;
  totalBuyinsChips?: string;
  totalFinalAmountChips?: string;
  differenceChips?: string;
};

function formatChipsPrimary(chips: string): string {
  return `${formatChipsNumber(chips)} фишек`;
}

function getChipsDifferenceMessage(chips: string): string | null {
  const difference = BigInt(chips);

  if (difference === 0n) {
    return null;
  }

  const absolute = difference < 0n ? difference * -1n : difference;
  const amountText = formatChipsPrimary(absolute.toString());

  if (difference > 0n) {
    return `Фишек получилось больше на ${amountText}. Проверьте ввод.`;
  }

  return `Фишек пока меньше на ${amountText}. Проверьте ввод.`;
}

function formatChipsWithMoneySecondary(
  chips: string,
  currency: string,
  chipsPerCurrencyUnit: number | null
): string {
  const moneyHint = formatChipsMoneyHint(chips, currency, chipsPerCurrencyUnit);

  return moneyHint ? `${formatChipsPrimary(chips)} · ${moneyHint}` : formatChipsPrimary(chips);
}

export function formatTransferAmountPrimary(
  chips: string,
  currency: string,
  chipsPerCurrencyUnit: number | null
): string {
  const moneyMinor = chipsToMoneyMinorLocal(chips, chipsPerCurrencyUnit);

  if (moneyMinor === null) {
    return `${formatChipsPrimary(chips)} · Курс не указан`;
  }

  return formatMinorMoney(moneyMinor, currency);
}

function formatChipsMoneyHint(
  chips: string,
  currency: string,
  chipsPerCurrencyUnit: number | null
): string | undefined {
  const moneyMinor = chipsToMoneyMinorLocal(chips, chipsPerCurrencyUnit);

  if (moneyMinor === null) {
    return undefined;
  }

  return formatMinorMoney(moneyMinor, currency);
}

function formatChipsRate(currency: string, chipsPerCurrencyUnit: number | null): string {
  if (!chipsPerCurrencyUnit || chipsPerCurrencyUnit <= 0) {
    return "Не указан";
  }

  return `1 ${getCurrencySymbolLocal(currency)} = ${formatChipsNumber(String(chipsPerCurrencyUnit))} фишек`;
}

function formatChipsNumber(value: string): string {
  const amount = BigInt(value);
  const isNegative = amount < 0n;
  const absolute = isNegative ? amount * -1n : amount;
  const formatted = absolute.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

  return isNegative ? `-${formatted}` : formatted;
}

function chipsToMoneyMinorLocal(chips: string, chipsPerCurrencyUnit: number | null): string | null {
  if (!chipsPerCurrencyUnit || chipsPerCurrencyUnit <= 0) {
    return null;
  }

  const rate = BigInt(chipsPerCurrencyUnit);
  const amount = BigInt(chips);
  const isNegative = amount < 0n;
  const absolute = isNegative ? amount * -1n : amount;
  const roundedMinor = (absolute * 100n + rate / 2n) / rate;
  const normalized = roundedMinor.toString();

  return isNegative ? `-${normalized}` : normalized;
}

function getCurrencySymbolLocal(currency: string): string {
  switch (currency.trim().toUpperCase()) {
    case "RUB":
      return "₽";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    default:
      return currency;
  }
}

function getRoomChipsPerCurrencyUnit(room: GetRoomResponseDto["room"]): number | null {
  const rate = (room as GetRoomResponseDto["room"] & ChipsCarrier).chipsPerCurrencyUnit;
  if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
    return rate;
  }

  if (typeof room.chipsPerCurrencyUnit === "string" && /^\d+$/.test(room.chipsPerCurrencyUnit)) {
    const parsed = Number.parseInt(room.chipsPerCurrencyUnit, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function getRoomRebuyChips(room: GetRoomResponseDto["room"]): string {
  return room.rebuyChips;
}

function getRoomTotalPotChips(room: GetRoomResponseDto["room"]): string {
  return room.totalPotChips;
}

function getPlayerTotalBuyinChips(player: RoomPlayerDto | SettlementDraftPlayer | null | undefined): string {
  if (!player) {
    return "0";
  }

  return player.totalBuyinChips;
}

function getPlayerFinalAmountChips(player: RoomPlayerDto | null | undefined): string {
  if (!player?.finalAmountChips) {
    return "0";
  }

  return player.finalAmountChips;
}

function getResultTotalBuyinChips(player: SettlementPlayerResultDto): string {
  return player.totalBuyinChips;
}

function getResultFinalAmountChips(player: SettlementPlayerResultDto): string {
  return player.finalAmountChips;
}

function getResultNetResultChips(player: SettlementPlayerResultDto): string {
  return player.netResultChips;
}

function getTransferAmountChips(transfer: SettlementTransferDto | { amountChips: string }): string {
  return transfer.amountChips;
}

function getRebuyAmountChips(rebuy: RebuyHistoryItemDto): string {
  return rebuy.amountChips;
}

function getAverageRebuyChips(items: RebuyHistoryItemDto[]): string {
  const itemsWithChips = items as Array<RebuyHistoryItemDto & ChipsCarrier>;

  if (itemsWithChips.length === 0) {
    return "0";
  }

  const total = itemsWithChips.reduce(
    (sum, item) => sum + BigInt(item.amountChips),
    0n
  );

  return (total / BigInt(itemsWithChips.length)).toString();
}

function getSummaryTotalBuyinsChips(summary: SettlementDraftSummary): string {
  return summary.totalBuyinsChips;
}

function getSummaryTotalFinalAmountChips(summary: SettlementDraftSummary): string {
  return summary.totalFinalAmountChips;
}

function getSummaryDifferenceChips(summary: SettlementDraftSummary): string {
  return summary.differenceChips;
}

function getSettlementTotalBuyinsChips(
  settlement: GetRoomResponseDto["settlement"],
  room: GetRoomResponseDto["room"]
): string {
  return settlement?.totalBuyinsChips ?? getRoomTotalPotChips(room);
}

function getSettlementTotalFinalAmountChips(
  settlement: GetRoomResponseDto["settlement"],
  room: GetRoomResponseDto["room"],
  players: SettlementPlayerResultDto[]
): string {
  if (settlement?.totalFinalAmountChips) {
    return settlement.totalFinalAmountChips;
  }

  return players.reduce((total, player) => total + BigInt(getResultFinalAmountChips(player)), 0n).toString();
}

function getMyNetResultChips(
  players: SettlementPlayerResultDto[],
  myPlayerId: string,
  room: GetRoomResponseDto["room"]
): string {
  void room;
  const player = players.find((item) => item.roomPlayerId === myPlayerId);
  return player ? getResultNetResultChips(player) : "0";
}
