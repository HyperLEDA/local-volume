// Strictly interpret only sub/sup markup from catalog metadata.
// Never use dangerouslySetInnerHTML: arbitrary metadata must remain text.
const SCRIPT_TAG = /(<sub>[^<>]*<\/sub>|<sup>[^<>]*<\/sup>)/g;
const EXACT_SCRIPT_TAG = /^<(sub|sup)>([^<>]*)<\/\1>$/;

type ParameterLabelProps = {
  nice: string | null | undefined;
  fallback: string;
};

export function ParameterLabel({ nice, fallback }: ParameterLabelProps) {
  const label = typeof nice === "string" && nice.trim() ? nice : fallback;
  const parts = label.split(SCRIPT_TAG);
  return (
    <>
      {parts.map((part, index) => {
        const match = EXACT_SCRIPT_TAG.exec(part);
        if (match === null) {
          return part;
        }
        return match[1] === "sub" ? (
          <sub key={index}>{match[2]}</sub>
        ) : (
          <sup key={index}>{match[2]}</sup>
        );
      })}
    </>
  );
}
