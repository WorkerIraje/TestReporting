// Configuration module for Iraje EPM Testing
const CONFIG = {
  // You'll set this manually with your logo base64 data
  LOGO_DATA_URL: "data:image/png;base64,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", // Insert your base64 logo data here
  
  // Map sheet names to expected column headers
  SHEET_MAP: {
    "EPM_TestCLogin": {
      moduleCol: "Module/Feature",
      idCol: "Test ID",
      titleCol: "Title/Description",
      fieldCol: "Field/Control ",       // trailing space present in file
      typeCol: "Test Type",
      preCol: "Preconditions",
      stepsCol: "Test Steps",
      dataCol: "Test Data",
      expectedCol: "Expected Result",
    },
    "Iraje EPM Post-Test Cases (Tem)": {
      moduleCol: "Module/Feature",
      idCol: "Test ID",
      titleCol: " Title/Description",   // leading space present in file
      fieldCol: "Field/Control ",       // trailing space
      typeCol: "Test Type",
      preCol: "Preconditions",
      stepsCol: "Test Steps",
      dataCol: "Test Data",
      expectedCol: "Expected Result",
    },
    "EPM_TestCPost": {
      moduleCol: "Module/Feature",
      idCol: "Test ID",
      titleCol: " Title/Description",   // leading space variant observed
      fieldCol: "Field/Control ",       // trailing space
      typeCol: "Test Type",
      preCol: "Preconditions",
      stepsCol: "Test Steps",
      dataCol: "Test Data",
      expectedCol: "Expected Result",
    },
    "Iraje EPM Post-Test Cases": {
      moduleCol: "Module/Feature",
      idCol: "Test ID",
      titleCol: " Title/Description",   // leading space variant
      fieldCol: "Field/Control ",       // trailing space
      typeCol: "Test Type",
      preCol: "Preconditions",
      stepsCol: "Test Steps",
      dataCol: "Test Data",
      expectedCol: "Expected Result",
    },
    "Iraje EPM Test Cases": {
      moduleCol: "Module/Feature",
      idCol: "Test ID",
      titleCol: "Title/Description",
      fieldCol: "Field/Control ",       // trailing space present
      typeCol: "Test Type",
      preCol: "Preconditions",
      stepsCol: "Test Steps",
      dataCol: "Test Data",
      expectedCol: "Expected Result",
    },
  },
  
  // Group display: "module" or "sheet"
  GROUP_BY: "module",
  
  // UI-only threshold (affects summary coloring if styled)
  PASS_THRESHOLD: 80,
  
  // Incremental render batch size
  RENDER_BATCH: 200,
};

// Export for other modules
window.CONFIG = CONFIG;
