"use client";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react-legacy";

type PasswordInputProps = Omit<ComponentProps<"input">, "type" | "ref"> & {
  id: string;
  fieldLabel: string;
};

export function PasswordInput({ fieldLabel, id, style, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = input.current?.form;
    const mask = () => setVisible(false);
    form?.addEventListener("reset", mask);
    return () => form?.removeEventListener("reset", mask);
  }, []);
  const Icon = visible ? EyeOff : Eye;
  const action = `${visible ? "Hide" : "Show"} ${fieldLabel}`;
  return (
    <span style={{ display: "block", position: "relative" }}>
      <input {...props} ref={input} id={id} type={visible ? "text" : "password"}
        style={{ ...style, width: "100%", boxSizing: "border-box", paddingInlineEnd: 44 }} />
      <button type="button" aria-label={action} title={action} aria-controls={id}
        onClick={() => setVisible(value => !value)}
        style={{ position: "absolute", insetInlineEnd: 2, top: 2, bottom: 2, width: 40, padding: 0,
          display: "grid", placeItems: "center", color: "inherit", background: "transparent", border: 0, cursor: "pointer" }}>
        <Icon size={18} aria-hidden="true" />
      </button>
    </span>
  );
}
