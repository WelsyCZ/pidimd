const editor = document.querySelector("#editor");
const preview = document.querySelector("#preview-section");
const sidebar = document.querySelector("#sidebar");
const nav = document.querySelector("#nav");
const main = document.querySelector("#main");
let mdflist;

// PARSER ------------------------
// regex rules paired with html which will replace the match
const headlineRules = [
    [/^#{3}\s+(.+)$/gm, "<h3>$1</h3>"],     //h3
    [/^#{2}\s+(.+)$/gm, "<h2>$1</h2>"],     //h2
    [/^#{1}\s+(.+)$/gm, "<h1>$1</h1><hr>"]  //h1
];

const bisRules = [
    [/(?<!\\)\*\*([^\n]*?[^\n\\])\*\*/g, "<b>$1</b>"], // **bold**
    [/(?<!\\)\*([^\n]*?[^\n\\])\*/g, "<i>$1</i>"], // *italic*
    [/(\s)__([^_\n]*?[^\n\\])__(\s)/g, "<b>$1$2$3</b>"], // __bold__
    [/(\s)_([^_\n]*?[^\n\\])_(\s)/g, "<i>$1$2$3</i>"], // _italic_
    [/(?<!\\)~~([^\n]*?[^\n\\])~~/g, "<s>$1</s>"] // ~~strikthrough~~
];

const escapeRules = [
    [/\\\*/g, "*"], // escape * 
    [/\\\_/g, "_"], // escape _
    [/\\\~/g, "~"]  // escape ~
];
// newline if end lines with 2 spaces or a backslash
const linebreakRule = [/(?:  |\\)$/gm, "<br>"];
// a paragraph is a line of text followed by 0 or more nonempty lines
const paragraphRule = [/^([A-Za-z].*(?:\n[A-Za-z].*)*)/gm, "<p>$1</p>"];
// URL or link validity is not checked, we only care about syntax
const linkRule = [/(?<!!)\[([^\n]+?)\]\(([^\n]+)\)/g,"<a href='$2'>$1</a>"];
const imgRule = [/!\[([^\n]+?)\]\(([^\n]+)\)/g, "<img src='$2' title='$1' style='max-width: 80%' />"];

/**
 * Parses markdown into HTML
 * 
 * @param {string} text - Text containing markdown we intend to parse
 * @returns {string} - HTML containing parsed text
 */
function parseMD(text){
    // headlines
    for(const [rule,template] of headlineRules){
        text = text.replace(rule, template);
    }
    
    // bold, italics
    for(const [rule,template] of bisRules){
        text = text.replace(rule, template);
    }
    
    // paragraph and linebreak
    text = text.replace(linebreakRule[0], linebreakRule[1]);
    text = text.replace(paragraphRule[0], paragraphRule[1]);
    
    // link
    text = text.replace(linkRule[0], linkRule[1]);

    // Image
    text = text.replace(imgRule[0], imgRule[1]);
    

    // remove backslashes for escaped characters
    for(const [rule,template] of escapeRules){
        text = text.replace(rule, template);
    }
    return text;
}

// PARSER END --------------------

/**
 * Renders the preview area
 * 
 * @param {string=} text - Optional argument, the text to be parsed
 * into html, if not specified, the editor content will be used
 */
function render(text = null){
    if(!text) text = $("#editor").val();
    let parsed = parseMD(text);
    preview.innerHTML = parsed;
    mdflist.saveFile();
}

/**
 * Wraps the selected text inside #editor textarea with given
 * prefix and suffix. In case of no selection, cursor position
 * is wrapped instead
 * 
 * @param {string} pref - prefix to go in front of selected text
 * @param {*} suff - suffix to go after the selected text
 */
function wrapSelection(pref, suff){
    let txt = $("#editor")[0];
    const bef = txt.value.substring(0,txt.selectionStart);
    const sel = txt.value.substring(txt.selectionStart, txt.selectionEnd);
    const aft = txt.value.substring(txt.selectionEnd);
    txt.value = `${bef}${pref}${sel}${suff}${aft}`;
}
const buttons = document.getElementsByTagName("button");
/**
 * Array of pairs [prefix,suffix] for toolbar buttons (in their order)
 * 
 * @type {string[][]}
 */
const wrappers = [
    ["**","**"],
    ["*","*"],
    ["~~","~~"],
    ["# ",""],
    ["## ",""],
    ["### ",""],
    ["[Enter Caption Here](",")"],
    ["![Enter Hover Text Here](",")"]
];

/** Class representing a markdown file */
class Filedotmd {
    /**
     * Create a new markdown file
     * @param {string} name - name of the markdown file 
     * @param {string} content - the literal text contents of the file
     * @param {boolean} open - status variable indicating if its open 
     */
    constructor(name, content, open=false){
        this.name = name;
        this.content = content;
        this.open = open;
    }
    /**
     * name getter
     * @returns file name
     */
    getName = () => {
        return this.name;
    }
    /**
     * getter for markdown content
     * @returns file text contents (raw markdown)
     */
    getContent = () => {
        return this.content;
    }
    /**
     * filename setter
     * @param {string} name - new name to be set 
     */
    setName = (name) => {
        this.name = name;
    }
    /**
     * markdown content setter
     * @param {string} content - new markdown content of the file to be set
     */
    setContent = (content) => {
        this.content = content;
    }
    /**
     * Open value setter
     * @param {boolean} open - status value if is open 
     */
    setOpen = (open) => {
        this.open = open;
    }
}
/** Class representing a list of all markdown files */
class Filelist{
    /**
     * Creates a new list of markdown files
     * @param {Array} files - list of cached file objects through localStorage
     */
    constructor(files=null){
        this.filenames = [];
        this.files = []; 
        this.curopen = null;
        if(files){ //import the cached files if provided
            let name,content,open;
            for(let file of files){
                name = file.name;
                content = file.content;
                open = file.open;
                this.newFile(name,content,open);
                if(open) this.curopen = name;
            }
        }
    }
    /**
     * Creates a new Filedotmd object and inserts into the list
     * @param {*} name - name of the new file
     * @param {*} content - content of the new file
     * @param {*} open - open status of the new file
     */
    newFile = (name=null, content=null, open=false) => {
        let nm = name && this.nameFree(name) ? name : this.getFreeName();
        content = content ? content : `# ${nm}\nContent...`;
        let nfile = new Filedotmd(nm,content,open);
        this.filenames.push(nm);
        this.files.push(nfile);
    }
    /**
     * Checks if a filename is available (they are unique)
     * @param {string} name - desired name
     * @returns {boolean} - true if available, false otherwise
     */
    nameFree = (name) => {
        return !this.filenames.includes(name);
    }
    /**
     * Generates a guaranteed free name for a file
     * @returns generated free name
     */
    getFreeName = () => {
        let name = `file${this.filenames.length+1}`;
        while(this.filenames.includes(name)){
            name = name + "1";
        }
        return name;
    }
    /**
     * filenames getter
     * @returns filenames of all existing files
     */
    getFilenames = () => {
        return this.filenames;
    }
    /**
     * files getter
     * @returns array of all Filedotmd objects
     */
    getFiles = () => {
        return this.files;
    }
    /**
     * Get a file by filename
     * @param {string} filename - name of the wanted file
     * @returns {Filedotmd} - Found file or null if not found
     */
    getFile = (filename) => {
        let index = this.filenames.indexOf(filename);
        return index > -1 ? this.files[index] : null;
    }
    /**
     * Rename an existing file based on filename
     * @param {string} oldname - name of an existing file to be renamed
     * @param {string} newname - the new filename after rename
     * @returns {boolean} - true if rename was successful, false otherwise
     */
    renameFile = (oldname, newname) => {
        let index = this.filenames.indexOf(oldname);
        if(index > -1){
            if(this.nameFree(newname)){
                this.filenames[index] = newname;
                this.files[index].setName(newname);
                this.curopen = newname;
                return true;
            }
        }
        return false;
    }
    /**
     * Opens an existing Filedotmd
     * @param {string} filename - filename of file to be opened
     */
    openFile = (filename) => {
        let file = this.getFile(filename);
        if(file){
            if(this.curopen){
                let opn = this.getFile(this.curopen);
                if(opn) opn.setOpen(false);
            }
            $('#editor').val(file.getContent());
            file.setOpen(true);
            this.curopen = filename;
            render();
        }
    }
    /**
     * Saves any changes made to the file
     */
    saveFile = () => {
        let file = this.getFile(this.curopen);
        if(!file) {
            console.log("no file to save");
            return;
        }
        file.setContent($("#editor").val());
    }
    /**
     * Delete a Filedotmd based on specified filename
     * @param {string} filename 
     */
    deleteFile = (filename) => {
        let index = this.filenames.indexOf(filename);
        if(index > -1){
            this.filenames.splice(index,1);
            this.files.splice(index,1);
            if(this.filenames.length > 0){
                this.openFile(this.filenames[0]);
            } else { // if we deleted the last file, create new example file
                this.newFile("example", welcometext);
                this.openFile("example");
            }
        }
    }

}

/**
 * Function that populates the collapsing sidebar
 * with all the existing Filedotmd buttons
 */
function populateSidebar(){
    nav.innerHTML = "";
    for(let file of mdflist.getFiles()){
        let div = document.createElement("div");
        div.className = "file";
        if(file.open) div.classList.add("open");
        div.innerText = file.getName();
        div.addEventListener("click", (e) => {
            // ignore clicks into the input field
            if(e.target.tagName == "INPUT"){
                return;
            } 
            mdflist.openFile(e.target.innerText);
            populateSidebar();
        });
        nav.appendChild(div);
    }
}

/**
 * Sound that pressing a button makes
 * @type {Audio}
 */
const buttonsound = new Audio("buttonsound.ogg");

// Add click event listener to hamburger button that opens sidebar
buttons[0].addEventListener("click", () => {
    buttonsound.play();
    sidebar.classList.toggle("sbon");
    main.classList.toggle("mainon");
});
// Add click event listeners to all toolbar buttons (bold, italic...)
for(let i = 1; i < 9; ++i){
    const [pref,suff] = wrappers[i-1];
    buttons[i].addEventListener("click", () => {
        buttonsound.play();
        wrapSelection(pref, suff);
        render();
    });
}
// Add click event listener to the plus button (creates new file)
document.getElementById("plus").addEventListener("click", () => {
    buttonsound.play();
    mdflist.newFile();
    let fnames = mdflist.getFilenames();
    mdflist.openFile(fnames[fnames.length-1]);
    populateSidebar();
});
/**
 * Add event listener to the rename button
 * 
 * renaming creates an input text field in place of the file name
 * the rename only goes through if enter is pressed, escape or
 * clicking elsewhere cancels it
 */
document.getElementById("rename").addEventListener("click", () => {
    let open = document.getElementsByClassName("open")[0];
    let oldname = open.innerHTML;
    open.innerHTML = "";
    let inptext = document.createElement("input");
    inptext.type = "text";
    inptext.value = oldname;
    inptext.onkeyup = (e) => {
        if(e.key === "Enter"){
            mdflist.renameFile(oldname,inptext.value);
            populateSidebar();
        }
        if(e.key === "Escape"){
            populateSidebar();
        }
    };
    inptext.addEventListener("focusout", () => {
        populateSidebar();
    });
    open.appendChild(inptext);
    inptext.select();
});
// Add event listener to the delete button, there is a confirmation
document.getElementById("delete").addEventListener("click", () => {
    let name = document.getElementsByClassName("open")[0].innerText;
    let rly = confirm(`Do you really want to delete the current file called '${name}'?`);
    if(rly) {
        mdflist.deleteFile(name);
        populateSidebar();
    }
});
// Add event listener to the help button
document.getElementById("help").addEventListener("click", () => {
    mdflist.newFile("Tutorial", tutorial);
    mdflist.openFile(mdflist.filenames[mdflist.filenames.length-1]);
    populateSidebar();
});

// Render any changes in the editor text area immediately
editor.addEventListener("input", e => {
    let content = e.target.value;
    render(content);
});

// LOCAL STORAGE ---------------


/**
 * Loads cached files from localStorage on page load
 * If no files are cached, a new example file is created instead
 */
window.onload = function() {
    // let cache = sessionStorage.getItem("cachedtext");
    // if(cache){
    //     $('#editor').val(cache);
    // } else {
    //     $('#editor').val(welcometext);
    // }
    // render();
    let files = localStorage.getItem("files");
    if(files){
        mdflist = new Filelist(JSON.parse(files));
        mdflist.openFile(mdflist.curopen);
    } else {
        mdflist = new Filelist();
        mdflist.newFile("example", welcometext);
        mdflist.openFile("example");
    }
    populateSidebar();
}
/**
 * Before closing the page, changes to the file are saved
 * and all files are cached into localStorage
 */
window.onbeforeunload = function() {
    mdflist.saveFile()
    localStorage.setItem("files", JSON.stringify(mdflist.getFiles()));
}
/**
 * Example file template
 * @type {string}
 */
const welcometext = `# Nadpis 1
## Nadpis 2
### Nadpis 3

Tohle je **tučnej paragraf**, *kurzíva* a ***tučná kurzíva***  
furt ten samej paragraf, ale jinej řádek


Tohle je už ale jinej paragraf. U**PRO**ST*ŘE*D

A tady je další __tučný__ a _cursive_  text.

Chci napsat \\* a potom zase \\* a třeba \\_

tučný hvězdičky ** \\*\\*\\*\\_\\_\\*\\*\\_ ** a podtržítka

jo a tady máš [odkaz](https://cs.wikipedia.org/wiki/Welsh_Corgi_Pembroke) na wiki o Corgim a taky jeho obrázek

![corgiiii](https://i.imgur.com/nP3SZ0j.jpg)

Ten je ~~zlej~~ hodnej, co? 

přeškrtlá ~~\\~~~ vlnovka
`

const tutorial = `# Návod
## Horní lišta (toolbar)

První (hamburger) tlačítko otevírá postranní menu se soubory  
**B** tlačítko - obalí vybraný text (nebo kurzor) značkami pro tučný text  
*I* tlačítko - obalí vybraný text (nebo kurzor) značkami pro kurzívu  
~~S~~ tlačítko - přeškrtnutý text

H1,H2,H3 - vytvoří nadpis 1. až 3. úrovně  
🔗 - vložení odkazu, formát je  [Viditelný text] (skutečný odkaz) bez mezery vprostřed
IMG - vložení obrázku, formát je ![Text při najetí na obrázek] (url obrázku) bez mezery vprostřed

## Boční lišta (otevíraná ☰ tlačítkem)

Obsahuje 4 tlačítka - vytvoření souboru, přejmenování současného souboru, smazání současného souboru a na **vytvoření tohoto návodného souboru**

Dále obsahuje seznam všech uložených markdown souborů, mezi kterými můžeme přepínat kliknutím

Soubory se ukládají při jakékoliv změně

`