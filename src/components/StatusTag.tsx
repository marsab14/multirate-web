import { Tag } from "antd";
import type { DocumentStatus } from "../types/api";

const COLORS: Record<DocumentStatus, string> = {
  draft: "blue",
  finalized: "green",
};

const LABELS: Record<DocumentStatus, string> = {
  draft: "Draft",
  finalized: "Finalized",
};

export default function StatusTag({ status }: { status: DocumentStatus }) {
  return <Tag color={COLORS[status]}>{LABELS[status]}</Tag>;
}
