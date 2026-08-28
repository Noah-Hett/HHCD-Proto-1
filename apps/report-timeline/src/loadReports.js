import { reports as catalogue, yearRange } from "@hhcd/data";

export const reports = catalogue.map((report, index) => ({
  ...report,
  uid: report.reportNo ?? `row-${index}`,
  methods: report.methodsPrimary ?? [],
}));

export { yearRange };
