
const UIRenderer = {

  renderAllSectionsIncremental() {
    const state = window.AppState;
    
    if (!state.flatRows || state.flatRows.length === 0) {
    
      if (window.App) {
        App.updateUIState();
      }
      return;
    }

    state.els.sectionsRoot.innerHTML = '';
    

    const groupOrder = [];
    const seenGroups = new Set();
    

    state.flatRows.forEach(row => {
      const groupKey = (CONFIG.GROUP_BY === "module")
        ? (row.module || row.sheet || "General")
        : row.sheet;
      
      if (!seenGroups.has(groupKey)) {
        seenGroups.add(groupKey);
        groupOrder.push(groupKey);
      }
    });

    let gi = 0;

    function renderNextGroup() {
      if (gi >= groupOrder.length) {
     
        if (window.App) {
          App.updateUIState();
        }
        return;
      }
      
      const key = groupOrder[gi++];
      const container = UIRenderer.renderGroupContainer(key);
      const rows = state.rowsByGroup[key] || [];
      

      let idx = 0;

      function renderBatch() {
        const end = Math.min(idx + CONFIG.RENDER_BATCH, rows.length);
        for (; idx < end; idx++) {
          container.body.appendChild(UIRenderer.renderRow(rows[idx]));
        }
        
        if (idx < rows.length) {
          if (requestIdleCallback) {
            requestIdleCallback(renderBatch);
          } else {
            setTimeout(renderBatch, 0);
          }
        } else {
          renderNextGroup();
        }
      }
      
      renderBatch();
    }
    
    renderNextGroup();
  },


  renderGroupContainer(groupKey) {
    const state = window.AppState;
    const groupRows = state.rowsByGroup[groupKey] || [];
    const totalCount = groupRows.length;
    
    const section = Utils.create("section", { class: "test-group" }, [
      Utils.create("h2", { class: "group-title" }, [
        Utils.create("span", {}, `📁 ${groupKey}`),
        Utils.create("span", { class: "group-count" }, ` (${totalCount} test${totalCount !== 1 ? 's' : ''})`),
        Utils.create("div", { class: "group-actions" }, [
          Utils.create("button", {
            class: "delete-group-btn",
            title: `Delete all test cases in ${groupKey}`,
            onclick: `deleteGroup('${groupKey}')`
          }, [
            Utils.create("i", { class: "fas fa-trash-alt" })
          ])
        ])
      ]),
      Utils.create("div", { class: "group-meta" }, `Loading ${totalCount} test cases...`),
      Utils.create("ul", { class: "checklist" })
    ]);
    
    state.els.sectionsRoot.appendChild(section);
    

    setTimeout(() => {
      const metaDiv = section.querySelector(".group-meta");
      if (metaDiv) {
        metaDiv.textContent = `${totalCount} test case${totalCount !== 1 ? 's' : ''} • Click on any test to expand details`;
      }
    }, 100);
    
    return { 
      root: section, 
      body: section.querySelector("ul.checklist") 
    };
  },

 
  renderRow(row) {
    const li = Utils.create("li", { class: "test-case-item", id: `test-${row.id}` });
    const saved = Storage.loadRowState(row.id) || {};

    this.applyStatusStyling(li, saved.status);

    
    const header = Utils.create("div", { class: "test-header" }, [
      Utils.create("div", { class: "test-title-section" }, [
        Utils.create("label", { class: "test-title" }, `${row.id} — ${row.title}`)
      ]),
      Utils.create("div", { class: "test-actions" }, [
        Utils.create("button", { 
          class: "delete-test-btn",
          title: "Delete this test case",
          onclick: `deleteTestCase('${row.id}')`
        }, [
          Utils.create("i", { class: "fas fa-times" })
        ])
      ])
    ]);


    const badges = [
      Utils.create("span", { class: "badge sheet" }, `Sheet: ${row.sheet}`),
      row.module ? Utils.create("span", { class: "badge module" }, `Module: ${row.module}`) : null,
      row.accCol ? Utils.create("span", { class: "badge account-type" }, `Account: ${row.accCol}`) : null,
      row.type ? Utils.create("span", { class: "badge type" }, `Type: ${row.type}`) : null,
      row.field ? Utils.create("span", { class: "badge field" }, `Field: ${row.field}`) : null,
    ].filter(Boolean);

    const metaBadges = Utils.create("div", { class: "meta-badges" }, badges);


    const details = Utils.create("div", { class: "test-details" }, [
      row.pre ? Utils.create("div", { class: "detail-item" }, [
        Utils.create("strong", {}, "Preconditions: "), 
        row.pre
      ]) : null,
      row.steps ? Utils.create("div", { class: "detail-item" }, [
        Utils.create("strong", {}, "Steps: "), 
        row.steps
      ]) : null,
      row.data ? Utils.create("div", { class: "detail-item" }, [
        Utils.create("strong", {}, "Test Data: "), 
        row.data
      ]) : null,
    ].filter(Boolean));


    const expectedResult = Utils.create("textarea", { 
      rows: "2", 
      placeholder: "Expected Result",
      class: "expected-result-field"
    }, row.expected || saved.expectedResult || "");
    
    expectedResult.addEventListener("input", () => {
      this.persistRowData(row.id, statusSel, attendedCheckbox, pendingCheckbox, notes, expectedResult, imageContainer);
    });


    const statusSel = Utils.create("select", { class: "status-selector" },
      ["", "Pass", "Fail", "Blocked"].map(val => {
        const opt = Utils.create("option", { value: val }, val || "— Select Status —");
   
        const currentStatus = saved.status || row.importedStatus || "";
        if (currentStatus === val) opt.selected = true;
        return opt;
      })
    );
    
    statusSel.addEventListener("change", () => {
      this.applyStatusStyling(li, statusSel.value);
      this.persistRowData(row.id, statusSel, attendedCheckbox, pendingCheckbox, notes, expectedResult, imageContainer);
      if (window.Summary) Summary.updateSummary();
      if (window.Dashboard) Dashboard.updateDashboard();
      this.updateModuleStatusSummary();
    });

    const attendedCheckbox = Utils.create("input", { 
      type: "checkbox", 
      id: `attended_${row.id}`,
      class: "attended-checkbox"
    });

    const isAttended = saved.attended || row.importedAttended || false;
    if (isAttended) attendedCheckbox.checked = true;
    
    const pendingCheckbox = Utils.create("input", { 
      type: "checkbox", 
      id: `pending_${row.id}`,
      class: "pending-checkbox"
    });

    const isPending = saved.pending || (!isAttended) || false;
    if (isPending && !isAttended) pendingCheckbox.checked = true;


    attendedCheckbox.addEventListener("change", () => {
      if (attendedCheckbox.checked) pendingCheckbox.checked = false;
      this.persistRowData(row.id, statusSel, attendedCheckbox, pendingCheckbox, notes, expectedResult, imageContainer);
      this.updateModuleStatusSummary();
      if (window.Dashboard) Dashboard.updateDashboard();
    });

    pendingCheckbox.addEventListener("change", () => {
      if (pendingCheckbox.checked) attendedCheckbox.checked = false;
      this.persistRowData(row.id, statusSel, attendedCheckbox, pendingCheckbox, notes, expectedResult, imageContainer);
      this.updateModuleStatusSummary();
      if (window.Dashboard) Dashboard.updateDashboard();
    });

    const notes = Utils.create("textarea", { 
      rows: "3", 
      placeholder: "Notes / Observations",
      class: "notes-field"
    }, saved.notes || row.importedActualResult || "");
    
    notes.addEventListener("input", () => {
      this.persistRowData(row.id, statusSel, attendedCheckbox, pendingCheckbox, notes, expectedResult, imageContainer);
    });

    const imageInput = Utils.create("input", { 
      type: "file", 
      accept: "image/*",
      multiple: true,
      class: "image-input"
    });
    
    const imageContainer = Utils.create("div", { class: "image-container" });
    
  
    this.loadExistingImages(row.id, imageContainer);

    imageInput.addEventListener("change", async () => {
      const files = Array.from(imageInput.files || []);
      for (const f of files) {
        if (this.isValidImageFile(f)) {
          try {
            const b64 = await Utils.fileToDataURL(f);
            this.addImageToContainer(b64, imageContainer, row.id);
            this.persistRowData(row.id, statusSel, attendedCheckbox, pendingCheckbox, notes, expectedResult, imageContainer);
          } catch(e) {
            console.warn("Failed to process image:", e);
            if (window.showErrorNotification) {
              showErrorNotification(`Failed to process image: ${f.name}`);
            } else {
              alert(`Failed to process image: ${f.name}`);
            }
          }
        } else {
          if (window.showErrorNotification) {
            showErrorNotification(`Invalid file type: ${f.name}. Please select image files only.`);
          } else {
            alert(`Invalid file type: ${f.name}. Please select image files only.`);
          }
        }
      }
  
      imageInput.value = "";
    });


    const controls = Utils.create("div", { class: "test-controls" }, [
      Utils.create("div", { class: "control-row" }, [
        Utils.create("div", { class: "control-group" }, [
          Utils.create("label", { class: "control-label" }, "Status: "),
          statusSel
        ]),
        Utils.create("div", { class: "checkbox-group" }, [
          Utils.create("label", { class: "checkbox-label" }, [
            attendedCheckbox,
            " Attended"
          ]),
          Utils.create("label", { class: "checkbox-label" }, [
            pendingCheckbox,
            " Pending"
          ])
        ])
      ]),
      Utils.create("div", { class: "control-group full-width" }, [
        Utils.create("label", { class: "control-label" }, "Expected Result: "),
        expectedResult
      ]),
      Utils.create("div", { class: "control-group full-width" }, [
        Utils.create("label", { class: "control-label" }, "Notes: "),
        notes
      ]),
      Utils.create("div", { class: "control-group full-width" }, [
        Utils.create("label", { class: "control-label" }, "Screenshots: "),
        imageInput,
        imageContainer
      ])
    ]);


    li.appendChild(header);
    li.appendChild(metaBadges);
    li.appendChild(details);
    li.appendChild(controls);

    return li;
  },


  applyStatusStyling(element, status) {

    element.classList.remove("status-pass", "status-fail", "status-blocked");
    
    
    if (status) {
      element.classList.add(`status-${status.toLowerCase()}`);
    }
  },

 
  isValidImageFile(file) {
    const validTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
      'image/webp', 'image/bmp', 'image/tiff'
    ];
    return validTypes.includes(file.type.toLowerCase());
  },


  loadExistingImages(testId, container) {
    const saved = Storage.loadRowState(testId) || {};
    if (saved.images && Array.isArray(saved.images)) {
      saved.images.forEach(src => {
        this.addImageToContainer(src, container, testId);
      });
    }
  },

 
  addImageToContainer(imageSrc, container, testId) {
    const imageWrapper = Utils.create("div", { class: "image-wrapper" });
    
    const img = new Image();
    img.src = imageSrc;
    img.className = "preview-image";
    
   
    img.addEventListener('click', () => {
      this.showImageModal(imageSrc);
    });
    
    const deleteBtn = Utils.create("button", { 
      class: "image-delete-btn",
      title: "Delete Image"
    }, "×");
    
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      
      if (confirm('Are you sure you want to delete this image?')) {

        const saved = Storage.loadRowState(testId) || {};
        if (saved.images) {
          saved.images = saved.images.filter(src => src !== imageSrc);
          Storage.saveRowState(testId, saved);
        }
        

        container.removeChild(imageWrapper);
        
        if (window.showSuccessNotification) {
          showSuccessNotification('Image deleted successfully.');
        }
      }
    });
    
    imageWrapper.appendChild(img);
    imageWrapper.appendChild(deleteBtn);
    container.appendChild(imageWrapper);
  },


  showImageModal(imageSrc) {
    const modal = Utils.create("div", { class: "image-modal", onclick: "this.remove()" }, [
      Utils.create("div", { class: "image-modal-content" }, [
        Utils.create("img", { src: imageSrc, class: "modal-image" }),
        Utils.create("button", { class: "image-modal-close", onclick: "this.parentElement.parentElement.remove()" }, "×")
      ])
    ]);
    
    document.body.appendChild(modal);
  },


  updateModuleStatusSummary() {

    if (window.Navigation && Navigation.getCurrentPage() === 'status' && window.Dashboard) {
      Dashboard.refreshStatus();
    }
  },


  persistRowData(testId, statusSel, attendedCheckbox, pendingCheckbox, notes, expectedResult, imageContainer) {
    const currentData = Storage.loadRowState(testId) || {};
    

    const imageElements = imageContainer.querySelectorAll(".preview-image");
    const images = Array.from(imageElements).map(img => img.src);
    
    const obj = {
      ...currentData, 
      status: statusSel.value || "",
      attended: attendedCheckbox.checked,
      pending: pendingCheckbox.checked,
      notes: notes.value || "",
      expectedResult: expectedResult.value || "",
      images: images,
      lastModified: new Date().toISOString()
    };
  
    Storage.saveRowState(testId, obj);
  
    setTimeout(() => {
      Storage.saveAppState();
    }, 100);
    console.log(`💾 Auto-saved test case ${testId}`);
  },


  deleteTestCase(testId) {
    const testElement = Utils.$(`#test-${testId}`);
    if (testElement) {

      testElement.style.transition = 'all 0.3s ease';
      testElement.style.opacity = '0';
      testElement.style.transform = 'translateX(-100%)';
      
      setTimeout(() => {
        if (testElement.parentElement) {
          testElement.parentElement.removeChild(testElement);
        }
        
   
        const groupElement = testElement.closest('.test-group');
        if (groupElement) {
          const remainingTests = groupElement.querySelectorAll('.test-case-item');
          if (remainingTests.length === 0) {
            groupElement.remove();
          } else {
  
            const groupTitle = groupElement.querySelector('.group-title .group-count');
            if (groupTitle) {
              const newCount = remainingTests.length;
              groupTitle.textContent = ` (${newCount} test${newCount !== 1 ? 's' : ''})`;
            }
          }
        }
      }, 300);
    }
  },


  refreshGroups() {
    const state = window.AppState;
    if (state.flatRows && state.flatRows.length > 0) {

      if (window.App && App.groupTestCases) {
        App.groupTestCases();
      }
      

      this.renderAllSectionsIncremental();
    } else {

      state.els.sectionsRoot.innerHTML = '';
      if (window.App) {
        App.updateUIState();
      }
    }
  }
};


window.deleteTestCase = function(testId) {
  if (!confirm('Are you sure you want to delete this test case? This action cannot be undone.')) {
    return;
  }

  try {

    window.AppState.flatRows = window.AppState.flatRows.filter(row => row.id !== testId);
    

    Storage.removeRowState(testId);
    

    UIRenderer.deleteTestCase(testId);
    

    if (window.App) {
      App.groupTestCases();
      App.updateUIState();
    }
    
    if (window.Dashboard) {
      Dashboard.updateDashboard();
    }
    
    if (window.Summary) {
      Summary.updateSummary();
    }
    
    if (window.showSuccessNotification) {
      showSuccessNotification('Test case deleted successfully.');
    }
    
  } catch (error) {
    console.error('Error deleting test case:', error);
    if (window.showErrorNotification) {
      showErrorNotification('Failed to delete test case. Please try again.');
    }
  }
};

window.deleteGroup = function(groupKey) {
  const groupRows = window.AppState.rowsByGroup[groupKey] || [];
  const count = groupRows.length;
  
  if (!confirm(`Are you sure you want to delete all ${count} test case${count !== 1 ? 's' : ''} in "${groupKey}" group? This action cannot be undone.`)) {
    return;
  }

  try {
 
    window.AppState.flatRows = window.AppState.flatRows.filter(row => {
      const rowGroup = (CONFIG.GROUP_BY === "module") 
        ? (row.module || row.sheet || "General")
        : row.sheet;
      return rowGroup !== groupKey;
    });
    

    groupRows.forEach(row => {
      Storage.removeRowState(row.id);
    });
    
 
    if (window.App) {
      App.groupTestCases();
    }
    
    UIRenderer.refreshGroups();
  
    if (window.Dashboard) {
      Dashboard.updateDashboard();
    }
    
    if (window.Summary) {
      Summary.updateSummary();
    }
    
    if (window.showSuccessNotification) {
      showSuccessNotification(`All test cases in "${groupKey}" group have been deleted.`);
    }
    
  } catch (error) {
    console.error('Error deleting group:', error);
    if (window.showErrorNotification) {
      showErrorNotification('Failed to delete group. Please try again.');
    }
  }
};


window.UIRenderer = UIRenderer;
