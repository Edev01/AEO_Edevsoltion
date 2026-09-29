"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  SeroqAction,
  SeroqActionStatus,
  SeroqActionTask,
  SeroqTaskStatus,
} from "@/components/dashboard/types";


type WhyPacket = {

  targetBrand:
    string;

  buyerJourney:
    string;

  observations: {
    validTrials:
      number;

    targetMentions:
      number;
  };

  gaps:
    Array<{
      dimension:
        string;
    }>;

  action: {

    title:
      string;

    priority:
      "high";

    reason:
      string;

    workPackage:
      string[];

  };

  baseline: {

    capturedAt:
      string;

    provider:
      string;

    validTrials:
      number;

    targetMentions:
      number;

    presenceRate:
      number;

  };

};


function makeId(
  prefix: string,
) {

  try {

    return `${prefix}-${crypto.randomUUID()}`;

  }
  catch {

    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  }

}


function normalize(
  value: string,
) {

  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );

}


function dedupKey(
  packet:
    WhyPacket,
) {

  return [
    "close-recommendation-gap",

    normalize(
      packet.targetBrand,
    ),

    normalize(
      packet.baseline
        .provider,
    ),

    normalize(
      packet.buyerJourney,
    ).slice(
      0,
      80,
    ),

  ].join(":");

}


function buildAction(
  packet:
    WhyPacket,
): SeroqAction {

  const now =
    new Date()
      .toISOString();


  const tasks:
    SeroqActionTask[] =
    packet.action
      .workPackage
      .map(
        (
          title,
          index,
        ) => ({

          id:
            makeId(
              "task",
            ),

          position:
            index + 1,

          title,

          status:
            /\bpublish\b/i.test(
              title,
            )
              ? "waiting_approval"
              : "todo",

          createdAt:
            now,

          updatedAt:
            now,

        }),
      );


  return {

    id:
      makeId(
        "action",
      ),

    dedupKey:
      dedupKey(
        packet,
      ),

    kind:
      "close_recommendation_gap",

    category:
      "compete",

    impact:
      "high",

    title:
      packet.action
        .title,

    reason:
      packet.action
        .reason,

    targetBrand:
      packet.targetBrand,

    buyerJourney:
      packet.buyerJourney,

    status:
      "new",

    outcome:
      "pending_measurement",

    signalIds: [
      "target_absence",

      ...packet.gaps.map(
        (gap) =>
          `proof_gap:${gap.dimension}`,
      ),
    ],

    baseline: {

      capturedAt:
        packet.baseline
          .capturedAt,

      provider:
        packet.baseline
          .provider,

      prompt:
        packet.buyerJourney,

      validTrials:
        packet.baseline
          .validTrials,

      targetMentions:
        packet.baseline
          .targetMentions,

      presenceRate:
        packet.baseline
          .presenceRate,

    },

    validation:
      null,

    tasks,

    events: [
      {

        id:
          makeId(
            "event",
          ),

        event:
          "created",

        createdAt:
          now,

        data: {

          baselineHits:
            packet.baseline
              .targetMentions,

          baselineTrials:
            packet.baseline
              .validTrials,

        },

      },
    ],

    createdAt:
      now,

    updatedAt:
      now,

    completedAt:
      null,

  };

}


function pretty(
  value: string,
) {

  return value
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    );

}


function pct(
  value: number,
) {

  return `${(
    value * 100
  ).toFixed(1)}%`;

}


export function ActionCenterPanel({
  actions,
  onActionsChange,
}: {

  actions:
    SeroqAction[];

  onActionsChange:
    (
      actions:
        SeroqAction[],
    ) => void;

}) {

  const [
    packet,
    setPacket,
  ] =
    useState<WhyPacket | null>(
      null,
    );


  const [
    measuringId,
    setMeasuringId,
  ] =
    useState<string | null>(
      null,
    );


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );


  const seededRef =
    useRef(
      false,
    );


  useEffect(
    () => {

      let alive =
        true;


      fetch(
        "/api/seroq/why",
        {
          cache:
            "no-store",
        },
      )
        .then(
          (
            response,
          ) =>
            response.json(),
        )
        .then(
          (data) => {

            if (
              alive
            ) {

              setPacket(
                data.packet ??
                  null,
              );

            }

          },
        )
        .catch(
          () => {

            if (
              alive
            ) {

              setPacket(
                null,
              );

            }

          },
        );


      return () => {

        alive =
          false;

      };

    },
    [],
  );


  useEffect(
    () => {

      if (
        !packet ||
        seededRef.current
      ) {
        return;
      }


      const key =
        dedupKey(
          packet,
        );


      seededRef.current =
        true;


      if (
        actions.some(
          (action) =>
            action.dedupKey ===
            key,
        )
      ) {
        return;
      }


      onActionsChange([
        buildAction(
          packet,
        ),
        ...actions,
      ]);

    },
    [
      packet,
      actions,
      onActionsChange,
    ],
  );


  const active =
    useMemo(
      () =>
        actions.filter(
          (action) =>
            action.status !==
              "completed" &&
            action.status !==
              "dismissed",
        ),
      [
        actions,
      ],
    );


  const history =
    useMemo(
      () =>
        actions.filter(
          (action) =>
            action.status ===
              "completed" ||
            action.status ===
              "dismissed",
        ),
      [
        actions,
      ],
    );


  function replaceAction(
    next:
      SeroqAction,
  ) {

    onActionsChange(
      actions.map(
        (action) =>
          action.id ===
          next.id
            ? next
            : action,
      ),
    );

  }


  function setStatus(
    action:
      SeroqAction,

    status:
      SeroqActionStatus,
  ) {

    const now =
      new Date()
        .toISOString();


    replaceAction({

      ...action,

      status,

      completedAt:
        status ===
        "completed"
          ? now
          : action.completedAt,

      outcome:
        status ===
        "completed"
          ? "pending_measurement"
          : action.outcome,

      updatedAt:
        now,

      events: [
        ...action.events,

        {

          id:
            makeId(
              "event",
            ),

          event:
            status ===
            "completed"
              ? "completed"
              : status ===
                  "dismissed"
                ? "dismissed"
                : "status_changed",

          createdAt:
            now,

          data: {

            from:
              action.status,

            to:
              status,

          },

        },
      ],

    });

  }


  function setTaskStatus(
    action:
      SeroqAction,

    taskId:
      string,

    status:
      SeroqTaskStatus,
  ) {

    const now =
      new Date()
        .toISOString();


    replaceAction({

      ...action,

      updatedAt:
        now,

      tasks:
        action.tasks.map(
          (task) =>
            task.id ===
            taskId
              ? {
                  ...task,
                  status,
                  updatedAt:
                    now,
                }
              : task,
        ),

      events: [
        ...action.events,

        {

          id:
            makeId(
              "event",
            ),

          event:
            "task_changed",

          createdAt:
            now,

          data: {
            taskId,
            status,
          },

        },
      ],

    });

  }


  async function remeasure(
    action:
      SeroqAction,
  ) {

    setError(
      null,
    );


    setMeasuringId(
      action.id,
    );


    try {

      const response =
        await fetch(
          "/api/seroq/remeasure",
          {

            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({

                prompt:
                  action.baseline
                    .prompt,

                targetBrand:
                  action.targetBrand,

                baseline: {

                  hits:
                    action.baseline
                      .targetMentions,

                  n:
                    action.baseline
                      .validTrials,

                },

              }),

          },
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.ok
      ) {

        throw new Error(
          data.error ??
            "Remeasurement failed.",
        );

      }


      const now =
        new Date()
          .toISOString();


      const measurement =
        data.measurement;


      replaceAction({

        ...action,

        outcome:
          data.outcome,

        validation: {

          measuredAt:
            measurement
              .generatedAt ??
            now,

          validTrials:
            measurement
              .presence
              .n,

          targetMentions:
            measurement
              .presence
              .hits,

          presenceRate:
            measurement
              .presence
              .rate,

          baselinePresenceRate:
            action.baseline
              .presenceRate,

          delta:
            measurement
              .presence
              .rate -
            action.baseline
              .presenceRate,

        },

        updatedAt:
          now,

        events: [
          ...action.events,

          {

            id:
              makeId(
                "event",
              ),

            event:
              "outcome_measured",

            createdAt:
              now,

            data: {

              outcome:
                data.outcome,

              beforeHits:
                action.baseline
                  .targetMentions,

              beforeN:
                action.baseline
                  .validTrials,

              afterHits:
                measurement
                  .presence
                  .hits,

              afterN:
                measurement
                  .presence
                  .n,

              statisticalClassification:
                data.comparison
                  .classification,

            },

          },
        ],

      });

    }
    catch (caught) {

      setError(
        caught instanceof Error
          ? caught.message
          : String(
              caught,
            ),
      );

    }
    finally {

      setMeasuringId(
        null,
      );

    }

  }


  if (
    !packet &&
    actions.length ===
      0
  ) {
    return null;
  }


  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e11]">

      <div className="border-b border-white/10 px-6 py-6 sm:px-7">

        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
          Action Center
        </div>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100">
          Evidence → execution → outcome.
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Completing work proves effort. Only a fresh measurement can tell us whether visibility moved.
        </p>

      </div>


      <div className="space-y-5 px-6 py-6 sm:px-7">

        {
          error
            ? (

              <div className="rounded-xl border border-red-300/20 bg-red-300/[0.04] p-4 text-sm text-red-200">
                {error}
              </div>

            )
            : null
        }


        {
          active.map(
            (
              action,
            ) => (

              <ActionCard
                key={
                  action.id
                }
                action={
                  action
                }
                onStatus={
                  (
                    status,
                  ) =>
                    setStatus(
                      action,
                      status,
                    )
                }
                onTaskStatus={
                  (
                    taskId,
                    status,
                  ) =>
                    setTaskStatus(
                      action,
                      taskId,
                      status,
                    )
                }
              />

            ),
          )
        }


        {
          history.length >
          0
            ? (

              <div className="border-t border-white/10 pt-5">

                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                  Completed work / outcomes
                </div>


                <div className="mt-3 grid gap-3">

                  {
                    history.map(
                      (
                        action,
                      ) => (

                        <article
                          key={
                            action.id
                          }
                          className="rounded-2xl border border-white/10 bg-black/20 p-5"
                        >

                          <div className="flex flex-wrap items-start justify-between gap-4">

                            <div>

                              <h3 className="text-sm font-medium text-zinc-200">
                                {
                                  action.title
                                }
                              </h3>

                              <div className="mt-2 text-xs text-zinc-500">

                                Baseline{" "}
                                {
                                  action.baseline
                                    .targetMentions
                                }
                                /
                                {
                                  action.baseline
                                    .validTrials
                                }

                                {" · "}

                                Outcome:{" "}
                                <span className="text-zinc-300">
                                  {
                                    pretty(
                                      action.outcome,
                                    )
                                  }
                                </span>

                              </div>

                            </div>


                            {
                              action.status ===
                                "completed" &&
                              action.outcome ===
                                "pending_measurement"
                                ? (

                                  <button
                                    type="button"
                                    disabled={
                                      measuringId ===
                                      action.id
                                    }
                                    onClick={
                                      () =>
                                        void remeasure(
                                          action,
                                        )
                                    }
                                    className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] px-4 py-2 text-xs font-medium text-cyan-100 disabled:cursor-wait disabled:opacity-50"
                                  >

                                    {
                                      measuringId ===
                                      action.id
                                        ? "Running 5 real trials…"
                                        : "Remeasure now"
                                    }

                                  </button>

                                )
                                : null
                            }

                          </div>


                          {
                            action.validation
                              ? (

                                <div className="mt-4 grid gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-3">

                                  <Metric
                                    label="Before"
                                    value={
                                      `${action.baseline.targetMentions}/${action.baseline.validTrials}`
                                    }
                                    detail={
                                      pct(
                                        action.baseline
                                          .presenceRate,
                                      )
                                    }
                                  />

                                  <Metric
                                    label="After"
                                    value={
                                      `${action.validation.targetMentions}/${action.validation.validTrials}`
                                    }
                                    detail={
                                      pct(
                                        action.validation
                                          .presenceRate,
                                      )
                                    }
                                  />

                                  <Metric
                                    label="Measured result"
                                    value={
                                      pretty(
                                        action.outcome,
                                      )
                                    }
                                    detail="Measured after work; no causation claim"
                                  />

                                </div>

                              )
                              : null
                          }

                        </article>

                      ),
                    )
                  }

                </div>

              </div>

            )
            : null
        }

      </div>

    </section>
  );

}


function ActionCard({
  action,
  onStatus,
  onTaskStatus,
}: {

  action:
    SeroqAction;

  onStatus:
    (
      status:
        SeroqActionStatus,
    ) => void;

  onTaskStatus:
    (
      taskId:
        string,

      status:
        SeroqTaskStatus,
    ) => void;

}) {

  const completed =
    action.tasks.filter(
      (task) =>
        task.status ===
        "completed",
    ).length;


  return (
    <article className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.025]">

      <div className="p-5">

        <div className="flex flex-wrap items-start justify-between gap-4">

          <div>

            <div className="flex gap-2">

              <span className="rounded-full border border-cyan-300/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">
                High impact
              </span>

              <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                {
                  pretty(
                    action.status,
                  )
                }
              </span>

            </div>


            <h3 className="mt-4 text-lg font-medium text-zinc-100">
              {
                action.title
              }
            </h3>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
              {
                action.reason
              }
            </p>

          </div>


          <div className="text-right">

            <div className="text-2xl font-semibold text-zinc-100">
              {completed}/{action.tasks.length}
            </div>

            <div className="text-xs text-zinc-600">
              tasks
            </div>

          </div>

        </div>


        <div className="mt-5 grid gap-2">

          {
            action.tasks.map(
              (
                task,
              ) => (

                <Task
                  key={
                    task.id
                  }
                  task={
                    task
                  }
                  onStatus={
                    (
                      status,
                    ) =>
                      onTaskStatus(
                        task.id,
                        status,
                      )
                  }
                />

              ),
            )
          }

        </div>


        <div className="mt-5 flex flex-wrap gap-2">

          {
            action.status ===
            "new"
              ? (

                <Button
                  onClick={
                    () =>
                      onStatus(
                        "in_progress",
                      )
                  }
                >
                  Start work
                </Button>

              )
              : null
          }


          {
            action.status ===
            "in_progress"
              ? (
                <>

                  <Button
                    onClick={
                      () =>
                        onStatus(
                          "on_hold",
                        )
                    }
                  >
                    Put on hold
                  </Button>

                  <Button
                    onClick={
                      () =>
                        onStatus(
                          "completed",
                        )
                    }
                  >
                    Work completed
                  </Button>

                </>
              )
              : null
          }


          {
            action.status ===
            "on_hold"
              ? (

                <Button
                  onClick={
                    () =>
                      onStatus(
                        "in_progress",
                      )
                  }
                >
                  Resume
                </Button>

              )
              : null
          }

        </div>

      </div>

    </article>
  );

}


function Task({
  task,
  onStatus,
}: {

  task:
    SeroqActionTask;

  onStatus:
    (
      status:
        SeroqTaskStatus,
    ) => void;

}) {

  const waiting =
    task.status ===
    "waiting_approval";


  const complete =
    task.status ===
    "completed";


  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">

      <button
        type="button"
        disabled={
          waiting
        }
        onClick={
          () =>
            onStatus(
              complete
                ? "todo"
                : "completed",
            )
        }
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/15 text-[10px] disabled:cursor-not-allowed disabled:opacity-30"
      >
        {
          complete
            ? "✓"
            : ""
        }
      </button>


      <div className="min-w-0 flex-1">

        <div
          className={
            complete
              ? "text-sm leading-6 text-zinc-600 line-through"
              : "text-sm leading-6 text-zinc-300"
          }
        >
          {
            task.title
          }
        </div>


        {
          waiting
            ? (

              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-amber-300">
                Human approval required
              </div>

            )
            : null
        }

      </div>


      {
        waiting
          ? (

            <button
              type="button"
              onClick={
                () =>
                  onStatus(
                    "todo",
                  )
              }
              className="rounded-lg border border-amber-300/20 px-2.5 py-1 text-[10px] text-amber-200"
            >
              Approve
            </button>

          )
          : null
      }

    </div>
  );

}


function Metric({
  label,
  value,
  detail,
}: {
  label:
    string;
  value:
    string;
  detail:
    string;
}) {

  return (
    <div className="bg-[#0b0e11] p-4">

      <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">
        {label}
      </div>

      <div className="mt-2 font-medium text-zinc-200">
        {value}
      </div>

      <div className="mt-1 text-xs text-zinc-600">
        {detail}
      </div>

    </div>
  );

}


function Button({
  children,
  onClick,
}: {
  children:
    ReactNode;
  onClick:
    () => void;
}) {

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] px-4 py-2 text-xs font-medium text-cyan-100"
    >
      {children}
    </button>
  );

}


