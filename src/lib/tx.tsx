import { Fragment, type ReactNode } from "react";
import { t } from "./i18n";

/**
 * A translated sentence with parts that aren't plain text, such as a size in
 * bold or a path in code: `tx("This frees about {0} once…", <b>{size}</b>)`.
 * The whole sentence is one key, so a translation can put the parts where
 * its own word order needs them.
 */
export function tx(text: string, ...parts: ReactNode[]): ReactNode {
  const pieces = t(text).split(/\{(\d+)\}/);
  return pieces.map((piece, i) => (i % 2 ? <Fragment key={i}>{parts[Number(piece)]}</Fragment> : piece));
}
