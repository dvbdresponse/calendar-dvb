import { createElement, useEffect } from "react";
import beeAnimation from "../assets/lordicon/bee.json?url";
import beeStill from "../assets/lordicon/bee.svg";

/** Lordicon's original 60 fps bee, with a still image while the player loads. */
export default function BeeIcon() {
  useEffect(() => {
    let mounted = true;
    import("@lordicon/element")
      .then(({ defineElement }) => {
        if (mounted) defineElement(); // Default motion mode respects prefers-reduced-motion.
      })
      .catch(() => { /* Keep the local still image if the optional player cannot load. */ });
    return () => { mounted = false; };
  }, []);

  return (
    <span className="bee-icon" aria-hidden="true">
      <img className="bee-icon__still" src={beeStill} width="32" height="32" alt="" draggable={false} />
      {createElement("lord-icon", {
        className: "bee-icon__player",
        src: beeAnimation,
        trigger: "loop",
        state: "hover-pinch",
        stroke: "regular",
        "aria-hidden": "true",
      })}
    </span>
  );
}
