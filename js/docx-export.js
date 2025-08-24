// DOCX export functionality
const DocxExport = {
    // Main export function
    async exportDocx() {
      if (!window.docx) {
        alert("DOCX library not loaded.");
        return;
      }
  
      const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, AlignmentType, Media } = docx;
      const state = window.AppState;
      
      // Build document
      const doc = new Document({ sections: [] });
  
      // Cover section
      await this.addCoverSection(doc, Media);
  
      // Summary section
      this.addSummarySection(doc, Table, TableRow, TableCell, Paragraph, HeadingLevel);
  
      // Detail sections per group
      await this.addDetailSections(doc, Paragraph, HeadingLevel, Media);
  
      // Generate and save
      const packer = new Packer();
      const buf = await packer.toBlob(doc);
      saveAs(buf, `Iraje_EPM_Testing_Report_${Date.now()}.docx`);
    },
  
    // Add cover page section
    async addCoverSection(doc, Media) {
      const state = window.AppState;
      const headerInfo = {
        date: state.els.reportDate?.value || "",
        tester: state.els.testerName?.value || "",
        signature: state.els.signature?.value || "",
      };
  
      const coverChildren = [];
  
      // Optional logo
      if (CONFIG.LOGO_DATA_URL) {
        try {
          const blob = await Utils.fetchDataUrlAsBlob(CONFIG.LOGO_DATA_URL);
          const img = Media.addImage(doc, blob, 200, 60);
          coverChildren.push(new docx.Paragraph({ 
            children: [img], 
            alignment: docx.AlignmentType.CENTER 
          }));
        } catch(e) {
          console.warn("Failed to add logo to DOCX:", e);
        }
      }
  
      coverChildren.push(
        new docx.Paragraph({ 
          text: "Iraje EPM Testing Report", 
          heading: docx.HeadingLevel.TITLE, 
          alignment: docx.AlignmentType.CENTER 
        }),
        new docx.Paragraph({ 
          text: `Date: ${headerInfo.date}`, 
          alignment: docx.AlignmentType.CENTER 
        }),
        new docx.Paragraph({ 
          text: `Tester: ${headerInfo.tester}`, 
          alignment: docx.AlignmentType.CENTER 
        }),
        new docx.Paragraph({ 
          text: `Signature: ${headerInfo.signature}`, 
          alignment: docx.AlignmentType.CENTER 
        }),
        new docx.Paragraph({ text: " " })
      );
  
      doc.addSection({ children: coverChildren });
    },
  
    // Add summary section
    addSummarySection(doc, Table, TableRow, TableCell, Paragraph, HeadingLevel) {
      const summary = Summary.computeSummary();
      
      const summaryRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: "Module" })] }),
            new TableCell({ children: [new Paragraph({ text: "Total" })] }),
            new TableCell({ children: [new Paragraph({ text: "Passed" })] }),
            new TableCell({ children: [new Paragraph({ text: "Failed/Blocked" })] }),
            new TableCell({ children: [new Paragraph({ text: "% Pass" })] }),
          ]
        })
      ];
  
      Object.keys(summary).sort().forEach(k => {
        const s = summary[k];
        const passPct = s.total ? (100 * s.pass / s.total) : 0;
        
        summaryRows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: k })] }),
            new TableCell({ children: [new Paragraph({ text: String(s.total) })] }),
            new TableCell({ children: [new Paragraph({ text: String(s.pass) })] }),
            new TableCell({ children: [new Paragraph({ text: String(s.fail + s.blocked) })] }),
            new TableCell({ children: [new Paragraph({ text: Utils.fmtPct(passPct) })] }),
          ]
        }));
      });
  
      doc.addSection({
        children: [
          new Paragraph({ text: "Automated Summary", heading: HeadingLevel.HEADING_1 }),
          new Table({ rows: summaryRows }),
          new Paragraph({ text: " " }),
        ]
      });
    },
  
    // Add detail sections
    async addDetailSections(doc, Paragraph, HeadingLevel, Media) {
      const state = window.AppState;
      const keys = Object.keys(state.rowsByGroup).sort();
  
      for (const groupKey of keys) {
        const rows = state.rowsByGroup[groupKey] || [];
        const children = [
          new Paragraph({ text: groupKey, heading: HeadingLevel.HEADING_1 }),
        ];
  
        for (const r of rows) {
          const saved = Storage.loadRowState(r.id) || {};
          
          children.push(new Paragraph({ 
            text: `${r.id} — ${r.title}`, 
            heading: HeadingLevel.HEADING_2 
          }));
  
          const metaLine = [
            r.sheet ? `Sheet: ${r.sheet}` : null,
            r.module ? `Module: ${r.module}` : null,
            r.type ? `Type: ${r.type}` : null,
            r.field ? `Field: ${r.field}` : null,
          ].filter(Boolean).join(" | ");
          
          if (metaLine) {
            children.push(new Paragraph({ text: metaLine }));
          }
  
          if (r.pre) children.push(new Paragraph({ text: `Preconditions: ${r.pre}` }));
          if (r.steps) children.push(new Paragraph({ text: `Steps: ${r.steps}` }));
          if (r.data) children.push(new Paragraph({ text: `Test Data: ${r.data}` }));
          if (r.expected) children.push(new Paragraph({ text: `Expected: ${r.expected}` }));
          
          children.push(new Paragraph({ text: `Status: ${saved.status || ""}` }));
          
          if (saved.notes) {
            children.push(new Paragraph({ text: `Notes: ${saved.notes}` }));
          }
  
          // Add screenshots if any
          if (saved.images && Array.isArray(saved.images) && saved.images.length) {
            children.push(new Paragraph({ 
              text: "Screenshots:", 
              heading: HeadingLevel.HEADING_3 
            }));
            
            for (const src of saved.images) {
              try {
                const blob = await Utils.fetchDataUrlAsBlob(src);
                const image = Media.addImage(doc, blob, 400, 225);
                children.push(new Paragraph({ children: [image] }));
              } catch(e) {
                console.warn("Failed to add image to DOCX:", e);
              }
            }
          }
  
          children.push(new Paragraph({ text: " " }));
        }
  
        doc.addSection({ children });
      }
    }
  };
  
  // Export function for HTML onclick
  window.exportDocx = () => DocxExport.exportDocx();
  window.DocxExport = DocxExport;
  