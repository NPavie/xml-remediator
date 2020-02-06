import React from 'react';
import './App.css';

// react-toastify for notifications
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import test_document from "./_tests/resources/document.json";
import { Box, ContentCSS } from './components/Box';
import RemediatedContentView from "./components/RemediatedContentView";
import BoxRemediation from './components/BoxRemediation';
import BoxFragment from './components/BoxFragment';

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


interface AppState {
    renderer_mode:ContentCSS,
    hovered_key:string,
    root_box:Box,
    remediations_stack:Array<{
        range:BoxFragment,
        remediation:BoxRemediation,
        is_activated:boolean,
        could_be_applied?:boolean}>,
    remediated_box:Box
}


export default class App extends React.Component <{},AppState> {

    
    constructor(props: any) {
        super(props);
        this.editorViewSelector = React.createRef();
        this.selectEditorMode = this.selectEditorMode.bind(this);
        this.onNodeHovering = this.onNodeHovering.bind(this);
        this.onRemediationActionCheck = this.onRemediationActionCheck.bind(this);
        this.onRemediationCheck = this.onRemediationCheck.bind(this);

        // Application should receive (or load somehow):
        // - A json bo document
        // - A list of (BoxFragment,BoxRemediation) tuples
        let root_box = Box.parse(JSON.stringify(test_document));

        let remediations_stack = new Array<{range:BoxFragment,remediation:BoxRemediation,is_activated:boolean}>();

        remediations_stack.push({
            range:new BoxFragment({block:0},3),
            remediation:new BoxRemediation({
                actions:[
                    {function_call:"transformTable(true)", is_activated:true},
                    {function_call:"markupHeading(Transformer.H1)",is_activated:true}],
                onActionChangeCallback:(action_index)=>{
                    this.onRemediationActionCheck(0,action_index)}
                }),
            is_activated:true
        });
        
        remediations_stack.push({
            range:new BoxFragment({block:1,inline:0},1),
            remediation:new BoxRemediation({
                actions:[
                    {function_call:"removeImage()", is_activated:true}],
                onActionChangeCallback:(action_index)=>{
                    this.onRemediationActionCheck(1,action_index)}
                }),
            is_activated:false
        });


        
        let result = root_box;
        remediations_stack.forEach((value:{range:BoxFragment,remediation:BoxRemediation, is_activated:boolean}) => {
            if(value.is_activated) result = value.remediation.applyOn(result,value.range);
        });
        
        this.state = {
            renderer_mode:ContentCSS.SEMANTIC,
            hovered_key:"",
            root_box:root_box,
            remediations_stack:remediations_stack,
            remediated_box:result
        };

        
    }

    
    
    editorViewSelector:any;
    /**
     * Change editor display selector
     */
    selectEditorMode(){
        console.log(this.editorViewSelector.current.value as ContentCSS);
        this.setState({
            renderer_mode:this.editorViewSelector.current.value as ContentCSS
        })
    }

    
    onNodeHovering(key:string,is_hovered:boolean){
        if(is_hovered){
            //console.log(key + " is hovered");   
            this.setState({hovered_key:key});
        } else {
            this.setState({hovered_key:""});
        }
    }

    /**
     * function called when a box range checkbox changes of state
     * @param stack_index 
     */
    onRemediationCheck(stack_index:number){
        this.state.remediations_stack[stack_index].is_activated = !this.state.remediations_stack[stack_index].is_activated;
        this.setState({
            remediations_stack:this.state.remediations_stack
        });
        this.updateResult();
    }

    /**
     * function called when an action checkbox changes state
     * @param stack_index 
     * @param action_index 
     */
    onRemediationActionCheck(stack_index:number,action_index:number){
        let stack_element = this.state.remediations_stack[stack_index];
        let i = 0;
        let new_actions = stack_element.remediation.props.actions.map((action)=>{
            let result = action;
            if(i++ === action_index){
                result.is_activated = !result.is_activated
            }
            return result;
        });
        this.state.remediations_stack[stack_index] = {
            range:stack_element.range,
            remediation:new BoxRemediation({
                actions:new_actions,
                onActionChangeCallback:(action_index)=>{
                    this.onRemediationActionCheck(stack_index,action_index)}}),
            is_activated:stack_element.is_activated
        }
        this.setState({
            remediations_stack:this.state.remediations_stack
        });
        this.updateResult();
    }

    /**
     * Request an update of the remediated result
     */
    updateResult(){
        
        let result = this.state.root_box;
        this.state.remediations_stack.forEach((value:{range:BoxFragment,remediation:BoxRemediation, is_activated:boolean}) => {
            try {
                if(value.is_activated) result = value.remediation.applyOn(result,value.range);
            } catch (error) {
                toast("This transformation cannot be applied in the selected state");
                // 
            }
        });
        this.setState({
            remediated_box:result
        });
    }

    render() {
        return (
            <div className="App">
                <ToastContainer />
                <header className="App-header">
                    <label>Display : </label>
                    <select ref={this.editorViewSelector} onChange={()=>{this.selectEditorMode()}} defaultValue={ContentCSS.SEMANTIC}>
                        <option value={ContentCSS.DEFAULT}>Original content</option>
                        <option value={ContentCSS.SEMANTIC}>Content with semantic</option>
                    </select>
                </header>
                <main className="App-frame">
                    <RemediatedContentView 
                        displayed_root={this.state.root_box}
                        displayed_result={this.state.remediated_box}
                        remediations_stack={this.state.remediations_stack}
                        onRemediationChangeCallback={this.onRemediationCheck} />
                </main>
                
            </div>
        );
    }
}
