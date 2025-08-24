// Export functionality
const ExportManager = {
    async exportDocx() {
        if (!window.docx) {
            alert("DOCX library not loaded.");
            return;
        }

        const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, AlignmentType, Media } = docx;
        const doc = new Document({ sections: [] });
        const state = window.AppState;
        const els = window.DOMElements;

        // Build document
        const headerInfo = {
            date: els.reportDate?.value || "",
            tester: els.testerName?.value || "",
            signature: els.signature?.value || "",
        };

        const coverChildren = [];

        // Optional logo
        if (CONFIG.LOGO_DATA_URL && !CONFIG.LOGO_DATA_URL.startsWith('data:')) {
            try {
                const response = await fetch(CONFIG.LOGO_DATA_URL);
                const blob = await response.blob();
                const img = Media.addImage(doc, blob, 200, 60);
                coverChildren.push(new Paragraph({ children: [img], alignment: AlignmentType.CENTER }));
            } catch(e) {
                console.warn('Could not load logo for export:', e);
            }
        }

        coverChildren.push(
            new Paragraph({ text: CONFIG.APP_NAME, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
            new Paragraph({ text: `Build: ${CONFIG.VERSION}`, alignment: AlignmentType.CENTER }),
            new Paragraph({ text: `Date: ${headerInfo.date}`, alignment: AlignmentType.CENTER }),
            new Paragraph({ text: `Tester: ${headerInfo.tester}`, alignment: AlignmentType.CENTER }),
            new Paragraph({ text: `Signature: ${headerInfo.signature}`, alignment: AlignmentType.CENTER }),
            new Paragraph({ text: " " })
        );
        doc.addSection({ children: coverChildren });

        // Summary section
        const summary = SummaryManager.computeSummary();
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
                    new TableCell({ children: [new Paragraph({ text: fmtPct(passPct) })] }),
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

        // Detail sections per group
        const keys = Object.keys(state.rowsByGroup).sort();
        for (const groupKey of keys) {
            const rows = state.rowsByGroup[groupKey] || [];
            const children = [
                new Paragraph({ text: groupKey, heading: HeadingLevel.HEADING_1 }),
            ];

            for (const r of rows) {
                const saved = StorageManager.loadRowState(r.id) || {};
                children.push(new Paragraph({ text: `${r.id} — ${r.title}`, heading: HeadingLevel.HEADING_2 }));
                
                const metaLine = [
                    r.sheet ? `Sheet: ${r.sheet}` : null,
                    r.module ? `Module: ${r.module}` : null,
                    r.type ? `Type: ${r.type}` : null,
                    r.field ? `Field: ${r.field}` : null,
                ].filter(Boolean).join(" | ");
                
                if (metaLine) children.push(new Paragraph({ text: metaLine }));
                if (r.pre) children.push(new Paragraph({ text: `Preconditions: ${r.pre}` }));
                if (r.steps) children.push(new Paragraph({ text: `Steps: ${r.steps}` }));
                if (r.data) children.push(new Paragraph({ text: `Test Data: ${r.data}` }));
                if (r.expected) children.push(new Paragraph({ text: `Expected: ${r.expected}` }));
                children.push(new Paragraph({ text: `Status: ${saved.status || ""}` }));
                if (saved.notes) children.push(new Paragraph({ text: `Notes: ${saved.notes}` }));

                if (saved.images && Array.isArray(saved.images) && saved.images.length) {
                    children.push(new Paragraph({ text: "Screenshots:", heading: HeadingLevel.HEADING_3 }));
                    for (const src of saved.images) {
                        try {
                            const blob = await fetchDataUrlAsBlob(src);
                            const image = Media.addImage(doc, blob, 400, 225);
                            children.push(new Paragraph({ children: [image] }));
                        } catch(e) {
                            console.warn('Could not add image to document:', e);
                        }
                    }
                }
                children.push(new Paragraph({ text: " " }));
            }
            doc.addSection({ children });
        }

        const packer = new Packer();
        const buf = await packer.toBlob(doc);
        const timestamp = new Date().toISOString().slice(0,19).replace(/:/g, '-');
        saveAs(buf, `${CONFIG.COMPANY_NAME}_Testing_Report_${timestamp}.docx`);
    }
};
