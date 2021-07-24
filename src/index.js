const { throws } = require("assert");

module.exports = (Plugin, Library) => {

    const latexRegex = /```(?:latex|tex)\n([^]*)```/i;

    const {Logger, Patcher, Settings, DiscordModules, DiscordAPI, WebpackModules, DiscordClasses, DiscordSelectors, Utilities, Modals, Tooltip} = Library;

    const fs = require("fs");
    const path = require("path");
    const childProcess = require('child_process');

    const { React, ReactDOM} = BdApi;

    function getLatexTemplate(code, textcolor) {
        return `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb,mhchem,amsfonts,xcolor${code.includes("tikz") ? ",tikz" : ""}}
${code.includes("tikz") ? "\\usetikzlibrary{calc}" : ""}
\\thispagestyle{empty}
\\begin{document}
${(textcolor ? "\\color{" + textcolor + "}" : "")}
${code}
\\end{document}`;
    }

    class SwitchWrapper extends DiscordModules.React.Component {
        constructor(props) {
            super(props);
            this.state = {enabled: this.props.value};
        }
    
        render() {
            return DiscordModules.React.createElement(DiscordModules.SwitchRow, Object.assign({}, this.props, {
                value: this.state.enabled,
                onChange: e => {
                    this.props.onChange(e);
                    this.setState({enabled: e});
                }
            }));
        }
    }

    /**
     * modified from https://github.com/BetterDiscord/BetterDiscord/blob/main/renderer/src/ui/customcss/editor.jsx
     */
    class CodeEditor extends React.Component {

        constructor(props) {
            super(props);

            this.props.theme = DiscordModules.UserSettingsStore && DiscordModules.UserSettingsStore.theme === "light" ? "vs" : "vs-dark";

            this.props.language = this.props.language.toLowerCase().replace(/ /g, "_");

            this.props.getValue = () => this.value

            this.bindings = [];
            this.resize = this.resize.bind(this);
            this.onChange = this.onChange.bind(this);
            this.onThemeChange = this.onThemeChange.bind(this);
        }

        static defaultProps = {
            language: "latex",
            id: "latex-editor",
            value: ""
        };

        componentDidMount() {
            this.editor = window.monaco.editor.create(document.getElementById(this.props.id), {
                value: this.props.value,
                language: this.props.language,
                theme: DiscordModules.UserSettingsStore.theme == "light" ? "vs" : "vs-dark",
                minimap: {
                    enabled: false
                }
            });

            window.addEventListener("resize", this.resize);
            if (DiscordModules.UserSettingsStore) DiscordModules.UserSettingsStore.addChangeListener(this.onThemeChange);
            this.bindings.push(this.editor.onDidChangeModelContent(this.onChange));
        }

        componentWillUnmount() {
            window.removeEventListener("resize", this.resize);
            if (DiscordModules.UserSettingsStore) DiscordModules.UserSettingsStore.removeChangeListener(this.onThemeChange);
            for (const binding of this.bindings) binding.dispose();
            this.editor.dispose();
        }

        onThemeChange() {
            const newTheme = DiscordModules.UserSettingsStore.theme === "light" ? "vs" : "vs-dark";
            if (newTheme === this.props.theme) return;
            this.props.theme = newTheme;
            window.monaco.editor.setTheme(this.props.theme);
        }

        get value() {return this.editor?.getValue();}
        set value(newValue) {this.editor?.setValue(newValue);}

        onChange() {
            if (this.props.onChange) this.props.onChange(this.value);
        }

        showSettings() {return this.editor.keyBinding.$defaultHandler.commands.showSettingsMenu.exec(this.editor);}
        resize() {this.editor.layout();}

        render() {
            if (this.editor && this.editor.layout) this.editor.layout();

            return React.createElement("div", {
                className: "editor-wrapper",
                style: {
                    height: "calc(70vh - 80px)",
                    maxHeight: "470px"
                }
            }, React.createElement("div", {
                id: this.props.id,
                className: "editor " + this.props.theme,
                style: {
                    height: "100%"
                }
            }));
        }
    }

    return class LaTeXPlugin extends Plugin {
        constructor() {
            super();
            this.btn = null;
        }

        onSwitch() {
            this.injectBtn();
        }

        createBtn() {
            const {button, contents, grow} = WebpackModules.find(m => m.button && m.grow);
            const discordButton = WebpackModules.getByProps("icon", "hoverScale");
            var btnContainer = document.createElement("div");
            btnContainer.classList.add(DiscordClasses.Textarea.buttonContainer);
            const tbtn = document.createElement("button");
            tbtn.classList.add(DiscordModules.ButtonData.ButtonColors.BRAND, DiscordModules.ButtonData.ButtonLooks.BLANK, button, grow, "LaTeX-plugin-button");
            const div = document.createElement("div");
            div.classList.add(DiscordClasses.Textarea.button, discordButton.button, contents);
            const innerDiv = document.createElement("div");
            innerDiv.classList.add(discordButton.buttonWrapper);
    
            innerDiv.innerText = "LaTeX";
            
            div.append(innerDiv);
            tbtn.append(div);
            tbtn.onauxclick = (a) => {
                if(a.button == 1) {
                    this.showSettingsModal();
                } else if(a.button == 2) {
                    var editor = React.createElement(CodeEditor,

                    );
                    var sval = false;
                    var el;
                    Modals.showModal(
                        "test", 
                        [
                            editor,
                            /*React.createElement(
                                BdApi.findModuleByDisplayName("TextArea"),
                                {
                                    onChange: val => tval = val
                                }
                            ),*/
                            (el = React.createElement(SwitchWrapper, {
                                value: false,
                                onChange: (e) => {
                                    sval = e;
                                },
                                children: "Send Code",
                                note: "",
                                hideBorder: false, 
                                style: {
                                    paddingTop: "20px"
                                }
                            }))
                        ],
                        {
                            confirmText: "Send",
                            onConfirm: async () => {
                                var channelid = DiscordAPI.currentChannel.id;
                                if (sval)
                                this.wrapText(editor.props.getValue(), 2000 - 15).forEach(t => DiscordModules.MessageActions.sendMessage(channelid, {
                                        "content": `\`\`\`latex\n${t}\n\`\`\``
                                    }, null, {}))
                                this.sendLatexCodeAsImage(editor.props.getValue(), channelid);
                            }
                        }
                    )
                }
            }
            tbtn.onclick = () => {
                var txtarea = document.querySelector(DiscordSelectors.Textarea.textArea);
                const slateEditor = Utilities.findInTree(txtarea.__reactInternalInstance$, e => e?.wrapText, {walkable: ["return", "stateNode", "editorRef"]}).wrapText("```latex\n", "\n```");
            };
            Tooltip.create(tbtn, "Right-Click to open popup, Middle-Click to open plugin settings");
            btnContainer.append(tbtn);
            return btnContainer;
        }

        injectBtn() {
            const Textarea = DiscordClasses.Textarea;
            const buttons = document.querySelector(`.${Textarea.buttons}`);
            if (buttons && buttons.getElementsByClassName("LaTeX-plugin-button").length == 0) {
                buttons.prepend(this.btn);
            }
        }

        onStart() {
            this.btn = this.createBtn();
            this.injectBtn();

            Patcher.before(DiscordModules.MessageActions, "sendMessage", (that, [channelid, msg, g, j]) => {
                if(this.settings["is_codeblocks"]) {
                    var res = latexRegex.exec(msg.content);
                    if(res) {
                        this.sendLatexCodeAsImage(res[1].trim(), channelid);
                        // 
                    }

                }

            });
        }
        sendLatexCodeAsImage(latexCode, channelid) {
            var tmpfolder = path.join(BdApi.Plugins.folder, "/latextmp/" + Date.now() + "/");
            this.sendLatexCodeAsImageT(latexCode, channelid, tmpfolder).then(()=> {
                fs.rmdirSync(tmpfolder, {
                    recursive: true
                });
            }).catch(err => {
                fs.rmdirSync(tmpfolder, {
                    recursive: true
                });
            });
        }

        sendLatexCodeAsImageT(latexCode, channelid, latextmpfolder) {
            return new Promise((resolve, reject) => {
                if(!latexCode.includes("\\documentclass")) {
                    latexCode = getLatexTemplate(latexCode, this.settings["is_text_color"] ? this.settings["text_color"] : null);
                }

                fs.mkdirSync(latextmpfolder, {
                    recursive: true
                });
                var tmpFile = path.join(latextmpfolder, "temp.tex");
                fs.writeFileSync(tmpFile, latexCode, {
                    encoding: "utf8",
                });


                childProcess.exec("latex -no-shell-escape -interaction=nonstopmode -halt-on-error temp.tex", {
                    cwd: latextmpfolder
                }, (err, stdout, stderr) => {
                    if(err) {
                        Modals.showAlertModal("error in LaTeX document", stdout)
                        console.log("error in LaTeX document");
                        console.log(stdout);
                        reject(err);
                    } else {
                        childProcess.exec("dvisvgm --no-fonts --exact --page=1- temp.dvi", {
                            cwd: latextmpfolder
                        }, (err, stdout, stderr) => {
                            if(err) {
                                Modals.showAlertModal("error converting dvi to svg", err)
                                console.log("error converting dvi to svg");
                                console.log(err);
                                reject(err);
                            } else {
                                var files = fs.readdirSync(latextmpfolder).filter(f => f.endsWith(".svg") && f.startsWith("temp")).map(f => f.slice(0, -4));
                                Promise.allSettled(files.map(f => new Promise((resolve, reject) => childProcess.exec("magick " + ((this.settings["show_background"] || this.settings["image_format"] != "png") ? "" : "-background transparent ") + "-density " + (this.settings["png_density"] || "400") + " " + f + ".svg " + f + "." + this.settings["image_format"], {
                                    cwd: latextmpfolder
                                }, (err, stdout, stderr) => {
                                    if(err) {
                                        Modals.showAlertModal("error converting svg to image", err.toString())
                                        console.log("error converting svg to image");
                                        console.log(err);
                                        reject(err);
                                    } else resolve()
                                })))).then(async (a) => {
                                    console.log(a)
                                    var i = 0;
                                    for(var [i, l] of a.entries()) {
                                        if(l.status == "fulfilled") {
                                            var f = files[i];
                                            await new Promise((resolve, reject) => {
                                                fs.readFile(path.join(latextmpfolder, f + "." + this.settings["image_format"]), (err, buffer) => {
                                                    if (err) {
                                                        Modals.showAlertModal("error uploading image", err.toString())
                                                        resolve();
                                                    } else {
                                                        BdApi.findModuleByProps("upload", "instantBatchUpload").upload(channelid, new Blob([buffer]), 0, "", false, "LaTeX-out-" + i++ + "." + this.settings["image_format"]);
                                                        resolve();
                                                    }
                                                        
                                                });
                                            });
                                        }
                                    }
                                    resolve();
                                }).catch(err => {
                                    Modals.showAlertModal("error converting svg to image", err.toString())
                                    console.log("error converting svg to image");
                                    console.log(err);
                                    reject();
                                });
                                
                            }
                        });
                    }
                });
            });
        }

        onStop() {
            this.btn?.remove?.();
            Patcher.unpatchAll();
        }

        getSettingsPanel() {
            return this.buildSettingsPanel().getElement();
        }

        wrapText(text, maxlength) {
            var execed = this.execWrapTextRegex(text, maxlength);
            if(!execed) return [];
            if(execed[2].trim() == "") return [execed[1].trim()];
            return [execed[1].trim(), ...this.wrapText(execed[2].trim(), maxlength)];
        }
        
        getWrapTextRexex = (splitter, maxlength) => new RegExp(`^([^]{1,${maxlength}})(?:${splitter}|$)([^]*)$`, "g");
        execWrapTextRegex = (txt, maxlength) => this.getWrapTextRexex("\n", maxlength).exec(txt) || this.getWrapTextRexex("\n", maxlength).exec(txt) || this.getWrapTextRexex("", maxlength).exec(txt);
    };

};