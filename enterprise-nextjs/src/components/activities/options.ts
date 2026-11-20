// Shared by server pages and client dialogs (must not live in a "use client" module).
export const TYPE_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "CALL", label: "Call", hint: "A phone call you made or plan to make" },
  { value: "MEETING", label: "Meeting", hint: "In person or online" },
  { value: "FOLLOW_UP", label: "Follow-up", hint: "Needs a due date and time" },
  { value: "TASK", label: "Task", hint: "Something to get done" },
  { value: "EMAIL", label: "Email", hint: "Record of an email sent outside the CRM" },
  { value: "NOTE", label: "Note", hint: "Information only; no due date or status" },
  { value: "OTHER", label: "Other", hint: "" },
];
