import { useEffect, useRef } from "react";

interface LordIconProps {
  src: string;
  trigger?: "hover" | "click" | "loop" | "morph" | "bounce" | "in";
  colors?: string; // e.g. "primary:#ffffff,secondary:#ff0000"
  size?: number;
  className?: string;
  stroke?: string; // e.g. "bold", "light"
}

export default function LordIcon({
  src,
  trigger = "hover",
  colors,
  size = 24,
  className = "",
  stroke = "70",
}: LordIconProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Inject Lordicon player library dynamically if not present
    if (!window.document.getElementById("lordicon-cdn-script")) {
      const script = window.document.createElement("script");
      script.id = "lordicon-cdn-script";
      script.src = "https://cdn.lordicon.com/lordicon.js";
      script.async = true;
      window.document.head.appendChild(script);
    }
  }, []);

  // Format colors or apply a smart default if needed
  // Lordicon has native colors attribute: primary, secondary, tertiary, quaternary, state
  const rawHtml = `<lord-icon
    src="${src}"
    trigger="${trigger}"
    state="hover"
    stroke="${stroke}"
    ${colors ? `colors="${colors}"` : ""}
    style="width:${size}px;height:${size}px"
  ></lord-icon>`;

  return (
    <div 
      ref={containerRef}
      className={`inline-flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-110 ${className}`}
      dangerouslySetInnerHTML={{ __html: rawHtml }}
    />
  );
}
