export type PresenceCounts = {
  hits: number;
  n: number;
};


const Z95 =
  1.959963984540054;


export function wilson(
  hits: number,
  n: number,
) {

  if (
    n <= 0
  ) {

    return {
      rate: 0,
      low: 0,
      high: 1,
    };

  }


  const p =
    hits / n;

  const z2 =
    Z95 * Z95;

  const denominator =
    1 + z2 / n;


  const centre =
    (
      p +
      z2 / (2 * n)
    ) /
    denominator;


  const margin =
    (
      Z95 *
      Math.sqrt(
        (
          p *
          (1 - p)
        ) /
          n +
        z2 /
          (
            4 *
            n *
            n
          ),
      )
    ) /
    denominator;


  return {

    rate:
      p,

    low:
      Math.max(
        0,
        centre -
          margin,
      ),

    high:
      Math.min(
        1,
        centre +
          margin,
      ),

  };
}


function intervalsOverlap(
  a: {
    low: number;
    high: number;
  },

  b: {
    low: number;
    high: number;
  },
) {

  return (
    a.low <=
      b.high &&
    b.low <=
      a.high
  );

}


function twoProportionZ(
  a: PresenceCounts,
  b: PresenceCounts,
) {

  if (
    a.n <= 0 ||
    b.n <= 0
  ) {

    return {
      z: 0,
      significant: false,
    };

  }


  const p1 =
    a.hits / a.n;

  const p2 =
    b.hits / b.n;


  const pooled =
    (
      a.hits +
      b.hits
    ) /
    (
      a.n +
      b.n
    );


  const standardError =
    Math.sqrt(
      pooled *
        (1 - pooled) *
        (
          1 / a.n +
          1 / b.n
        ),
    );


  if (
    standardError === 0
  ) {

    return {
      z: 0,
      significant: false,
    };

  }


  const z =
    (
      p1 -
      p2
    ) /
    standardError;


  return {

    z,

    significant:
      Math.abs(
        z,
      ) >
      Z95,

  };
}


/*
 * Conservative rule adapted from aeo-platform:
 *
 * Change is SIGNAL only when:
 *  1. Wilson intervals DO NOT overlap, AND
 *  2. two-proportion z-test is significant.
 *
 * Everything else is treated as sampling noise.
 */
export function classifyPresenceChange(
  before:
    PresenceCounts,

  after:
    PresenceCounts,
) {

  const beforeCi =
    wilson(
      before.hits,
      before.n,
    );


  const afterCi =
    wilson(
      after.hits,
      after.n,
    );


  const overlap =
    intervalsOverlap(
      beforeCi,
      afterCi,
    );


  const zTest =
    twoProportionZ(
      before,
      after,
    );


  const classification =
    !overlap &&
    zTest.significant
      ? "signal"
      : "noise";


  return {

    classification,

    overlap,

    z:
      zTest.z,

    beforeCi,

    afterCi,

  } as const;

}


export function derivePresenceOutcome(
  before:
    PresenceCounts,

  after:
    PresenceCounts,
):
  | "improved"
  | "no_meaningful_change"
  | "declined"
  | "not_measurable" {

  if (
    before.n <= 0 ||
    after.n <= 0
  ) {
    return "not_measurable";
  }


  const comparison =
    classifyPresenceChange(
      before,
      after,
    );


  if (
    comparison.classification ===
    "noise"
  ) {

    return "no_meaningful_change";

  }


  const beforeRate =
    before.hits /
    before.n;


  const afterRate =
    after.hits /
    after.n;


  if (
    afterRate >
    beforeRate
  ) {
    return "improved";
  }


  if (
    afterRate <
    beforeRate
  ) {
    return "declined";
  }


  return "no_meaningful_change";

}
