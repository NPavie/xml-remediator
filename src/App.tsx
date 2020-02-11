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
import Transformer from './components/Transformer';

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
    choosen_css:ContentCSS,
    hovered_key:string,
    root_box:Box,
    remediations_stack:Array<{
        range:BoxFragment,
        remediation:BoxRemediation,
        is_activated:boolean,
        could_be_applied?:boolean}>,
    fragments_root_box_keys:Array<Array<string>>,
    remediated_box:Box,
    fragments_remediated_box_keys:Array<Array<string>>
}


export default class App extends React.Component <{},AppState> {

    
    constructor(props: any) {
        super(props);
        this.editorViewSelector = React.createRef();
        this.onCSSSelection = this.onCSSSelection.bind(this);
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
            choosen_css:ContentCSS.SEMANTIC,
            hovered_key:"",
            root_box:root_box,
            remediations_stack:remediations_stack,
            remediated_box:result,
            fragments_root_box_keys:remediations_stack.map((value:{range:BoxFragment})=>{
                return this.computeFragmentKeys(root_box,value.range);
            }),
            fragments_remediated_box_keys:remediations_stack.map((value:{range:BoxFragment})=>{
                return this.computeFragmentKeys(result,value.range);
            })
        };

    }

    computeFragmentKeys(doc:Box,fragment:BoxFragment){
        return  new Transformer(doc).moveTo(
                    fragment.block,
                    fragment.size,
                    fragment.inline
                ).getFragmentKeys();
    }
    
    
    editorViewSelector:any;
    /**
     * Change editor display selector
     */
    onCSSSelection(){
        const css_selector = (value:string)=>{
            switch(+value){
                case ContentCSS.SEMANTIC as number:
                    return ContentCSS.SEMANTIC;
                case ContentCSS.DEFAULT as number:
                default :
                    return ContentCSS.DEFAULT;
            }
        }
        // Note : the "current.value" is of type string
        this.setState({
            choosen_css:css_selector(this.editorViewSelector.current.value)
        })
    }

    
    onNodeHovering(key:string,is_hovered:boolean){
        if(is_hovered){  
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
        let new_stack = this.state.remediations_stack.slice();
        new_stack[stack_index].is_activated = !new_stack[stack_index].is_activated;
        let remediated_box = this.updateResult(new_stack);
        
        // update the remediated fragments keys
        let stack_element = this.state.remediations_stack[stack_index];
        let verif = new Transformer(remediated_box).moveTo(
            stack_element.range.block,
            stack_element.range.size,
            stack_element.range.inline
        ).getFragmentKeys();
        this.state.fragments_remediated_box_keys[stack_index] = verif
        
        this.setState({
            fragments_remediated_box_keys:this.state.fragments_remediated_box_keys,
            remediations_stack:new_stack,
            remediated_box:remediated_box
        });
    }

    /**
     * function called when an action checkbox changes state
     * @param stack_index 
     * @param action_index 
     */
    onRemediationActionCheck(stack_index:number,action_index:number){
        let new_stack = this.state.remediations_stack.slice();
        let stack_element = new_stack[stack_index];
        let i = 0;
        let new_actions = stack_element.remediation.props.actions.map((action)=>{
            let result = action;
            if(i++ === action_index){
                result.is_activated = !result.is_activated
            }
            return result;
        });
        new_stack[stack_index] = {
            range:stack_element.range,
            remediation:new BoxRemediation({
                actions:new_actions,
                onActionChangeCallback:(action_index)=>{
                    this.onRemediationActionCheck(stack_index,action_index)}}),
            is_activated:stack_element.is_activated
        }
        
        let remediated_box = this.updateResult(new_stack);
        // update the remediated fragments keys
        let verif = new Transformer(remediated_box).moveTo(
            stack_element.range.block,
            stack_element.range.size,
            stack_element.range.inline
        ).getFragmentKeys();
        this.state.fragments_remediated_box_keys[stack_index] = verif
        
        this.setState({
            remediations_stack:new_stack,
            fragments_remediated_box_keys:this.state.fragments_remediated_box_keys,
            remediated_box:remediated_box
        });

    }

    /**
     * Request an update of the remediated result, request the state update and return the new remediated box
     */
    updateResult(with_new_stack:Array<{range:BoxFragment,remediation:BoxRemediation,is_activated:boolean}>){
        
        let result = this.state.root_box;
        with_new_stack.forEach((value:{range:BoxFragment,remediation:BoxRemediation, is_activated:boolean}) => {
            try {
                if(value.is_activated) result = value.remediation.applyOn(result,value.range);
            } catch (error) {
                toast("This transformation cannot be applied in the selected state");
                //  TODO : mark the fragment and the transformation (and the action ?) as "in error" in the UI
            }
        });
        return result;
    }

    render() {
        return (
            <div className="App">
                <ToastContainer />
                <header className="App-header">
                    <label htmlFor="display-selector">Select a CSS</label>
                    <select name="display-selector" id="display-selector" ref={this.editorViewSelector} onChange={()=>{this.onCSSSelection()}} defaultValue={ContentCSS.SEMANTIC}>
                        <option value={ContentCSS.DEFAULT}>Original content</option>
                        <option value={ContentCSS.SEMANTIC}>Content with semantic</option>
                    </select>
                </header>
                <main className="App-frame">
                    <RemediatedContentView 
                        displayed_root={this.state.root_box}
                        displayed_result={this.state.remediated_box}
                        remediations_stack={this.state.remediations_stack}
                        onRemediationChangeCallback={this.onRemediationCheck} 
                        fragments_result_keys={this.state.fragments_remediated_box_keys}
                        fragments_root_keys={this.state.fragments_root_box_keys}
                        content_css={this.state.choosen_css}/>
                </main>
                
            </div>
        );
    }
}
