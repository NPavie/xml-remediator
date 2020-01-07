import React from 'react';
import './App.css';

import { FileInput } from './components/FileInput';
//import ContentView from './components/ContentView';


// react-toastify for notifications
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

/*
import AceEditor from 'react-ace';
import 'brace/mode/javascript';
import 'brace/mode/xml';
import 'brace/mode/html';
import 'brace/mode/css';
import 'brace/mode/text';
import 'brace/mode/plain_text';

import 'brace/theme/github';
import 'brace/theme/monokai';
*/

import DOMRemediation from './components/DOMRemediation';
//import RemediationView from './components/RemediationView';

import test_document from "./temp/document.json";
import { Box, BoxRenderMode, BoxType } from './components/Box';
import BoxTreeWalker from './components/BoxTreeWalker';
import ContextualMenu from './components/ContextualMenu';
import BoxTreeView from './components/BoxTreeView';
import RemediatedContentView from "./components/RemediatedContentView";

/**
 * Hash of available ace modes per extension
 */
const ace_mode_for_extension: { [key: string]: string } = {
    "xhtml": "xml",
    "xml": "xml",
    "ncx": "xml",
    "opf": "xml",
    "html": "html",
    "htm": "html",
    "css": "css",
    "txt": "plain_text"
};

/**
 * Retrieve the Ace mode from file extension.
 * If no mode is avaible, the plain_text mode is used
 * @param {string} filepath path or name of the file to visualise with ace
 */
function getMode(filepath: string) {
    let temp = filepath.split('.');
    if (temp.length > 1) {
        let mode = ace_mode_for_extension[temp.pop()!];
        return mode !== undefined ? mode : ace_mode_for_extension["txt"];
    } else {
        return ace_mode_for_extension["txt"];
    }
}


/**
 * Hash of the used mimetype per extension
 */
const mimetypeMap: { [key: string]: string } = {
    "png": "image/png",
    "jpe": "image/jpeg",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "svg": "image/svg+xml",
    "xhtml": "application/xhtml+xml",
    "xml": "text/xml",
    "html" : "text/html",
    "txt":"text/plain"
};
function getMimetypeAs<T>(filepath:string):T{
    let temp = filepath.split('.');
    if (temp.length > 1) {
        let mimetype = mimetypeMap[temp.pop()!];
        return mimetype !== undefined ? mimetype as unknown as T : mimetypeMap["txt"] as unknown as T;
    } else {
        return mimetypeMap["txt"] as unknown as T;
    }
}


export default class App extends React.Component {

    state = {
        renderer_mode:BoxRenderMode.SEMANTIC,
        input_viewer_css: ["App-input-viewer", "show"],
        drawer_button_css: ["App-button"],
        output_viewer_css: ["App-output-viewer", "with-drawer"],
        remediations_css:["App-remediation"],
        editor_width: "auto",
        input_file: "",
        input_content: "",
        output_content: "",
        hovered_key:"",
        applicable_remediations: new Array<DOMRemediation>(),
        applied_remediations_stack: new Array<DOMRemediation>(),
        root_box:Box.parse(JSON.stringify(test_document))
    };

    

    constructor(props: any) {
        super(props);
        this.editorViewSelector = React.createRef();
        this.selectEditorMode = this.selectEditorMode.bind(this);
        this.onNodeHovering = this.onNodeHovering.bind(this);
    }
    
    editorViewSelector:any;
    /**
     * Change editor display selector
     */
    selectEditorMode(){
        console.log(this.editorViewSelector.current.value as BoxRenderMode);
        this.setState({
            renderer_mode:this.editorViewSelector.current.value as BoxRenderMode
        })
    }

    loadingToastId: React.ReactText = "";
    
    undoLastRemediation(){
        let stack = this.state.applied_remediations_stack;
        stack.pop();
        this.updateRemediationsStack(stack);
    }

    onRemediationApplied(remediation_to_apply:DOMRemediation){
        // push remediation on application stack
        let stack = this.state.applied_remediations_stack;
        stack.push(remediation_to_apply);
        this.updateRemediationsStack(stack);
    }

    
    updateRemediationsStack(new_remediations_stack:Array<DOMRemediation>){
        let currentContent = this.state.input_content;
        if(this.state.input_file){
           let mimetype = getMimetypeAs<SupportedType>(this.state.input_content);
            new_remediations_stack.forEach(remediation => {
                currentContent = remediation.applyOn(currentContent);
            });
        }
        
        // update stack and content output content
        this.setState({
            applied_remediations_stack:new_remediations_stack,
            output_content:currentContent
        });
    }

    onNodeHovering(key:string,is_hovered:boolean){
        if(is_hovered){
            //console.log(key + " is hovered");   
            this.setState({hovered_key:key});
        } else {
            this.setState({hovered_key:""});
        }
    }


    render() {
        // var switchingView: String =
        //     this.state.raw_mode === true ?
        //         "Switch to text viewer" :
        //         "Switch to tree viewer";

        let rootBox = new Box({
            hovered_key:this.state.hovered_key,
            attributes:this.state.root_box.props.attributes,
            type:this.state.root_box.props.type,
            name:this.state.root_box.props.name,
            isReplacedElement:this.state.root_box.props.isReplacedElement,
            children:this.state.root_box.props.children,
            render_mode:this.state.renderer_mode
        });

        
        return (
            <div className="App">
                <ToastContainer />
                <header className="App-header">
                    <label>Display : </label>
                    <select ref={this.editorViewSelector} onChange={()=>{this.selectEditorMode()}} defaultValue={BoxRenderMode.SEMANTIC}>
                        <option value={BoxRenderMode.HTML}>Original content</option>
                        <option value={BoxRenderMode.SEMANTIC}>Content with semantic</option>
                    </select>
                </header>
                <main className="App-frame">
                    <RemediatedContentView 
                        displayed_root={rootBox}
                        transformations_stack={[]}
                        />
                </main>
                
            </div>
        );
    }
}

/*


        // let document_rows = new Array<Box>();
        // let boxes_queue = new Array<Box>();
        // boxes_queue.push(rootBox);
        // while(boxes_queue.length > 0){
        //     for(let current_box of boxes_queue){
        //         console.log(current_box);
        //         // Parse children 
        //         for(let child of current_box.children){
        //             // if the child has a "table-row" display or is a block with only inline boxes
        //             if(child.props.cssprops ? 
        //                     (child.props.cssprops.display === "table-row" || 
        //                         (child.props.cssprops.display === "block" && 
        //                             child.props.children.length > 0 && 
        //                             child.props.children[0].props.type === BoxType.INLINE)) : 
        //                     child.props.type === BoxType.INLINE){
        //                 // the child is the root of a "row"
        //                 document_rows.unshift(child);
        //             } else {
        //                 // add the child to the boxe queue
        //                 boxes_queue.push(child);   
        //             }
        //         }
        //         // Remove the current box from the array
        //         boxes_queue.shift();
        //     }
        // }
        

        //let resultBox = rootBox;

        /*<BoxTreeView box={rootBox} 
                            with_content={false} 
                            onHoveringCallback={(key,status)=>this.onNodeHovering(key,status)}/>
        

        // new UI proposal : 
        // Header actions : 
        // - Expand the content tree
        // - See content with original or semantic css
        // On the left, the document tree
        // on the center, the higlighted content
        // on the left the action menu

<footer className="App-footer" />
<div className="App-content">
                        <div className="document-in">
                            <Box type={rootBox.props.type}
                                name={rootBox.props.name}
                                attributes={rootBox.props.attributes}
                                text={rootBox.props.text}
                                isReplacedElement={rootBox.props.isReplacedElement}
                                children={rootBox.props.children}
                                cssprops={rootBox.props.cssprops}
                                parent_key={rootBox.props.parent_key}
                                hovered_key={rootBox.props.hovered_key}
                                parent_index={rootBox.props.parent_index}
                                selected_key={rootBox.props.selected_key}
                                virtual={rootBox.props.virtual}
                                render_mode={rootBox.props.render_mode}/>
                        </div>
                        <div className="document-out">
                            <Box type={rootBox.props.type}
                                name={rootBox.props.name}
                                attributes={rootBox.props.attributes}
                                text={rootBox.props.text}
                                isReplacedElement={rootBox.props.isReplacedElement}
                                children={rootBox.props.children}
                                cssprops={rootBox.props.cssprops}
                                parent_key={rootBox.props.parent_key}
                                hovered_key={rootBox.props.hovered_key}
                                parent_index={rootBox.props.parent_index}
                                selected_key={rootBox.props.selected_key}
                                virtual={rootBox.props.virtual}
                                render_mode={rootBox.props.render_mode}/>
                        </div>
                    </div>
                    <ContextualMenu className="App-context_menu"/>
*/