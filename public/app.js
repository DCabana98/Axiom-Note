document.addEventListener('DOMContentLoaded', () => {
    const DOMElements = {
        contextoSelector: document.getElementById('contexto-informe'),
        themeSelect: document.getElementById('theme-select'),
        formSections: {
            urgencias: document.getElementById('urgencias-fields'),
            planta: document.getElementById('planta-fields'),
            evolutivo: document.getElementById('evolutivo-fields')
        },
        allFormInputs: document.querySelectorAll('#note-form input, #note-form textarea, #note-form select'),
        clearBtn: document.getElementById('clear-btn'),
        generateBtn: document.getElementById('generate-btn'),
        exportPdfBtn: document.getElementById('export-pdf-btn'),
        copyAllBtn: document.getElementById('copy-all-btn'),
        embarazoContainer: document.getElementById('urg-embarazo-container'),
        sexoSelector: document.getElementById('urg-sexo'),
        resultText: document.getElementById('result-text'),
        recommendationsText: document.getElementById('recommendations-text'),
        keywordsText: document.getElementById('keywords-text'),
        copyReportBtn: document.getElementById('copy-report-btn'),
        copyRecsBtn: document.getElementById('copy-recs-btn'),
        copyKeywordsBtn: document.getElementById('copy-keywords-btn'),
        spinner: document.getElementById('spinner'),
        btnText: document.getElementById('btn-text'),
    };

    const WordCounterManager = {
        init() {
            document.querySelectorAll('.pattern-group textarea, .datos-grid textarea').forEach(textarea => {
                const counter = document.createElement('span');
                counter.className = 'word-counter';
                textarea.parentElement.appendChild(counter);
                textarea.addEventListener('input', () => this.update(textarea, counter));
                this.update(textarea, counter);
            });
        },
        update(textarea, counter) {
            const text = textarea.value;
            const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).filter(Boolean).length;
            counter.textContent = `${wordCount} ${wordCount === 1 ? 'palabra' : 'palabras'}`;
        },
        updateAllVisible() {
            document.querySelectorAll('.pattern-group textarea, .datos-grid textarea').forEach(textarea => {
                if (textarea.offsetParent !== null) {
                    const counter = textarea.parentElement.querySelector('.word-counter');
                    if (counter) {
                        this.update(textarea, counter);
                    }
                }
            });
        }
    };

    const FormManager = {
        init() {
            DOMElements.contextoSelector.addEventListener('change', this.toggleFields.bind(this));
            DOMElements.allFormInputs.forEach(input => input.addEventListener('input', this.saveState.bind(this)));
            DOMElements.clearBtn.addEventListener('click', this.clear.bind(this));
            DOMElements.sexoSelector.addEventListener('change', this.toggleEmbarazoField.bind(this));
            this.toggleFields();
            this.setInitialDateTime(); 
        },
        saveState() {
            const contexto = DOMElements.contextoSelector.value;
            const data = {};
            const activeForm = DOMElements.formSections[contexto];
            if (activeForm) {
                activeForm.querySelectorAll('input, textarea, select').forEach(el => {
                    data[el.id] = el.value;
                });
                localStorage.setItem(`axiomNoteData_${contexto}`, JSON.stringify(data));
            }
        },
        loadState(contexto) {
            const savedData = localStorage.getItem(`axiomNoteData_${contexto}`);
            if (savedData) {
                const data = JSON.parse(savedData);
                for (const id in data) {
                    const element = document.getElementById(id);
                    if (element) element.value = data[id];
                }
            }
        },
        toggleFields() {
            const contexto = DOMElements.contextoSelector.value;
            Object.values(DOMElements.formSections).forEach(section => section.classList.add('hidden'));
            const activeSection = DOMElements.formSections[contexto];
            if (activeSection) {
                activeSection.classList.remove('hidden');
                this.loadState(contexto);
            }
            this.toggleEmbarazoField();
            WordCounterManager.updateAllVisible();
        },
        clear() {
            const contexto = DOMElements.contextoSelector.value;
            const activeForm = DOMElements.formSections[contexto];
            if (activeForm) {
                activeForm.querySelectorAll('input, textarea, select').forEach(field => {
                    if (field.tagName === 'SELECT') field.selectedIndex = 0;
                    else field.value = '';
                });
                localStorage.removeItem(`axiomNoteData_${contexto}`);
            }
            this.setInitialDateTime();
            WordCounterManager.updateAllVisible();
        },
        toggleEmbarazoField() {
            const isWoman = DOMElements.sexoSelector.value === 'Mujer';
            DOMElements.embarazoContainer.classList.toggle('hidden', !isWoman);
        },
        setInitialDateTime() {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            const formattedDateTime = now.toISOString().slice(0, 16);

            const urgField = document.getElementById('urg-fecha-hora');
            if (urgField && !urgField.value) {
                urgField.value = formattedDateTime;
                urgField.dispatchEvent(new Event('input'));
            }
            
            const evoField = document.getElementById('evo-fecha-hora');
            if (evoField && !evoField.value) {
                evoField.value = formattedDateTime;
                evoField.dispatchEvent(new Event('input'));
            }
        }
    };

    const ThemeManager = {
        init() {
            const savedTheme = localStorage.getItem('theme') || 'light';
            this.apply(savedTheme);
            DOMElements.themeSelect.value = savedTheme;
            DOMElements.themeSelect.addEventListener('change', (e) => {
                const newTheme = e.target.value;
                localStorage.setItem('theme', newTheme);
                this.apply(newTheme);
            });
        },
        apply(theme) {
            document.body.classList.toggle('dark-mode', theme === 'dark');
        }
    };

    const ActionManager = {
        init() {
            DOMElements.generateBtn.addEventListener('click', this.generateNote.bind(this));
            DOMElements.exportPdfBtn.addEventListener('click', this.exportToPDF.bind(this));
            DOMElements.copyAllBtn.addEventListener('click', () => this.copyFullReport());
            DOMElements.copyReportBtn.addEventListener('click', () => this.copyToClipboard(DOMElements.resultText.value, 'Evolución copiada'));
            DOMElements.copyRecsBtn.addEventListener('click', () => this.copyToClipboard(DOMElements.recommendationsText.value, 'Recomendaciones copiadas'));
            DOMElements.copyKeywordsBtn.addEventListener('click', () => this.copyToClipboard(DOMElements.keywordsText.value, 'Palabras clave copiadas'));
        },
        async generateNote() {
            DOMElements.generateBtn.disabled = true;
            DOMElements.spinner.classList.remove('hidden');
            DOMElements.btnText.textContent = "Generando...";

            const contexto = DOMElements.contextoSelector.value;
            let incomingData = {
                contexto
            };
            DOMElements.formSections[contexto].querySelectorAll('input, textarea, select').forEach(field => {
                if (field.id && field.value.trim() !== '' && !field.closest('.hidden')) {
                    const key = field.id; 
                    incomingData[key] = field.value;
                }
            });

            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        incomingData
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Error del servidor: ${response.statusText}`);
                }
                
                const data = await response.json();
                DOMElements.resultText.value = data.report || "";
                DOMElements.recommendationsText.value = data.recommendations || "";
                DOMElements.keywordsText.value = data.keywords || "";

            } catch (error) {
                DOMElements.resultText.value = `Error: ${error.message}`;
            } finally {
                DOMElements.generateBtn.disabled = false;
                DOMElements.spinner.classList.add('hidden');
                DOMElements.btnText.textContent = "Generar Texto";
            }
        },
        // FUNCIÓN DE EXPORTAR A PDF COMPLETA Y CORREGIDA
        exportToPDF() {
            const reportText = DOMElements.resultText.value;
            if (!reportText.trim()) {
                this.copyToClipboard('', 'No hay informe generado para exportar.');
                return;
            }

            const contexto = DOMElements.contextoSelector.value;
            let nombre = 'N/A', edad = 'N/A';
            
            const activeForm = DOMElements.formSections[contexto];
            if(activeForm) {
                const nombreEl = activeForm.querySelector('input[id*="-nombre"]');
                const edadEl = activeForm.querySelector('input[id*="-edad"]');
                if(nombreEl) nombre = nombreEl.value || 'N/A';
                if(edadEl) edad = edadEl.value || 'N/A';
            }

            const fechaEl = document.getElementById(`${contexto}-fecha-hora`);
            const fecha = fechaEl && fechaEl.value ? new Date(fechaEl.value).toLocaleString('es-ES') : new Date().toLocaleString('es-ES');

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFont("Inter", "normal");
            let y = 20;

            doc.setFontSize(18);
            doc.text("Informe Clínico - Axiom Note", 105, y, { align: "center" });
            y += 15;
            
            doc.setFontSize(12);
            doc.text(`Paciente: ${nombre}`, 15, y);
            doc.text(`Edad: ${edad}`, 15, y + 7);
            doc.text(`Fecha del Informe: ${fecha}`, 15, y + 14);
            y += 28;
            
            doc.setLineWidth(0.5);
            doc.line(15, y, 195, y);
            y += 10;

            const addSection = (title, textContent) => {
                if (!textContent || !textContent.trim()) return;
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text(title, 15, y);
                y += 8;
                doc.setFontSize(12);
                doc.setFont(undefined, 'normal');
                const splitText = doc.splitTextToSize(textContent, 180);
                
                splitText.forEach(line => {
                    if (y > 280) { 
                        doc.addPage(); 
                        y = 20; 
                    }
                    doc.text(line, 15, y);
                    y += 7;
                });
                y += 10;
            };

            addSection("Nota de Evolución", DOMElements.resultText.value);
            addSection("Recomendaciones y Plan", DOMElements.recommendationsText.value);
            addSection("Resumen (Palabras Clave)", DOMElements.keywordsText.value);
            
            const fileName = `Informe_${nombre.replace(/\s+/g, '_') || 'AxiomNote'}.pdf`;
            doc.save(fileName);
        },
        copyToClipboard(text, message) {
            if (!text || !text.trim()) {
                Toastify({
                    text: "No hay nada que copiar",
                    duration: 3000,
                    gravity: "bottom",
                    position: "right",
                    style: {
                        background: "linear-gradient(to right, #ff5f6d, #ffc371)",
                    }
                }).showToast();
                return;
            }
            navigator.clipboard.writeText(text).then(() => {
                Toastify({
                    text: message || "¡Texto copiado!",
                    duration: 3000,
                    gravity: "bottom",
                    position: "right",
                    style: {
                        background: "linear-gradient(to right, #00b09b, #96c93d)",
                    }
                }).showToast();
            });
        },
        copyFullReport() {
            const report = DOMElements.resultText.value;
            const recs = DOMElements.recommendationsText.value;
            const keywords = DOMElements.keywordsText.value;
            if (!report && !recs && !keywords) {
                 this.copyToClipboard('', 'No hay nada que copiar');
                 return;
            }
            let fullText = "";
            if (report) fullText += `NOTA DE EVOLUCIÓN\n${"-".repeat(20)}\n${report}\n\n`;
            if (recs) fullText += `RECOMENDACIONES Y PLAN\n${"-".repeat(20)}\n${recs}\n\n`;
            if (keywords) fullText += `RESUMEN (PALABRAS CLAVE)\n${"-".repeat(20)}\n${keywords}`;
            this.copyToClipboard(fullText.trim(), 'Informe completo copiado');
        }
    };
    
    const App = {
        init() {
            FormManager.init();
            ThemeManager.init();
            WordCounterManager.init();
            ActionManager.init();
        }
    };

    App.init();
});