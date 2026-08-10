import { Tag } from "antd";
import type { DocumentStatus } from "../types/api";

const COLORS: Record<DocumentStatus, string> = {
  draft: "default",
  sent: "processing",
  paid: "success",
  void: "error",
};

const LABELS: Record<DocumentStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  void: "Void",
};

export default function StatusTag({ status }: { status: DocumentStatus }) {
  return <Tag color={COLORS[status]}>{LABELS[status]}</Tag>;
}
