import { reports as catalogue } from "@hhcd/data";

export const reports = catalogue.map((report) => ({
  ...report,
  methods: report.methodsPrimary ?? [],
}));
