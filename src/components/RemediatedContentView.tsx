import React, { Fragment } from "react";
import Transformation from "./Transformer";
import { Box, BoxRenderMode, BoxType } from './Box';
import BoxTreeWalker from './BoxTreeWalker';

import "./RemediatedContentView.css";

import "../css/html5-semantic-classes.css";
import BoxRemediation from "./BoxRemediation";
import BoxFragment from "./BoxFragment";


/**
 * 
 */
interface RemediatedContentViewProperties{
    selectionCallback?:(selected_key:string)=>void,
    displayed_root:Box,
    displayed_result:Box,
    remediations_stack:Array<{range:BoxFragment,remediation:BoxRemediation, is_activated:boolean}>,
    onRemediationChangeCallback?:(stack_index:number)=>void,
    css_stylesheet?:string

}

interface RemediatedContentViewState{
    last_hovered_keys:Array<string>|undefined,
    selected_keys:Array<string>|undefined,
}

export default class RemediatedContentView extends React.Component<RemediatedContentViewProperties,RemediatedContentViewState>{

    constructor(props:RemediatedContentViewProperties){
        super(props);
        
        
        this.state = {
            last_hovered_keys:[],
            selected_keys:[]
        };
        this.isHoveringBox = this.isHoveringBox.bind(this);
        this.isLeavingBox = this.isLeavingBox.bind(this);

        
    }
    
    isHoveringBox(key:string){
        
        this.setState({
            last_hovered_keys:[key]
        });
    }

    isLeavingBox(key:string){
        let elements = key.split('/');
        let new_key = elements.slice(0,elements.length - 1).join("/");

        this.setState({
            last_hovered_keys:new_key.length > "/html[0]/body[0]".length ? [new_key]:undefined
        });
    }

    isSelectingBox(key:string){
        // TODO : Add a "new remediation" button when one or more boxes are selected
        // check if ctrl or shift is pressed to allow selective 
        this.setState({
            selected_keys:[key]
        });
        
    }

    onRemediationChange(remediation_index:number){
        if(this.props.onRemediationChangeCallback) this.props.onRemediationChangeCallback(remediation_index);
        
        // let result = this.props.displayed_root;
        // this.props.remediations_stack.forEach((value:{range:BoxFragment,remediation:BoxRemediation, is_activated:boolean}) => {
        //     if(value.is_activated) {
        //         result = value.remediation.applyOn(result,value.range);
        //     }
        // });
        // this.setState({
        //     displayed_result:result
        // });

    }


    /**
     * From a given box, compute the array of boxes that are blocks 
     * with only inlined (or aligned on a single line) children (like p or tr)
     * @param root_box root box to compute the rows from
     */
    private static computeBoxRows(root_box:Box){
        let box_rows = new Array<Box>();
        let boxes_queue = new Array<Box>();
        boxes_queue.push(root_box);
        while(boxes_queue.length > 0){
            let current_box = boxes_queue.shift()!;
            if(current_box.props.cssprops ? 
                    (current_box.props.cssprops.display === "table-row" || 
                        (current_box.props.cssprops.display === "block" && 
                            current_box.props.children.length > 0 && 
                            current_box.props.children[0].props.type === BoxType.INLINE)) : 
                    current_box.props.type === BoxType.INLINE){
                // the box is the root of a "row"
                box_rows.push(current_box);
            } else for(let i = current_box.props.children.length; i--;) {
                boxes_queue.unshift(current_box.props.children[i]);   
            }
        }
        return box_rows;
    }

    // Render the documents and the transformations stack
    render(){
        
        // for each box, compute the array of "lowest block box"
        let in_rows = RemediatedContentView.computeBoxRows(this.props.displayed_root);
        let out_rows = RemediatedContentView.computeBoxRows(this.props.displayed_result);
        
        let rows = new Array<JSX.Element>();
        let in_count = 0, out_count = 0,line_key = 0;
        let hovered_keys = this.state.last_hovered_keys;
       
        while(in_count < in_rows.length || out_count < out_rows.length ){
            if(in_count >= in_rows.length){ // no more input line to render
                // only render output line
                rows.push(
                    <tr key={`doc_leaf_${line_key}`}>
                        <td key={`doc_leaf_${line_key}_out`}>{out_rows[out_count].computeIsolatedReactNode({
                            rendering_start_path:'/html[0]/body[0]',
                            use_semantic_css:true,
                            hovering_pathes:hovered_keys,
                            onMouseEnterCallback:this.isHoveringBox,
                            onMouseLeaveCallback:this.isLeavingBox
                            })}</td>
                        <td key={`doc_leaf_${line_key}_in`}/>
                    </tr>);
                ++out_count;
                ++line_key;
            } else if (out_count >= out_rows.length){ // no more output line to render
                // only render input line
                rows.push(
                    <tr key={`doc_leaf_${line_key}`}>
                        <td key={`doc_leaf_${line_key}_out`}/>
                        <td key={`doc_leaf_${line_key}_in`}>{in_rows[in_count].computeIsolatedReactNode({
                            rendering_start_path:'/html[0]/body[0]',
                            use_semantic_css:true,
                            hovering_pathes:hovered_keys,
                            onMouseEnterCallback:this.isHoveringBox,
                            onMouseLeaveCallback:this.isLeavingBox
                            })}</td>
                    </tr>);
                ++in_count;
                ++line_key;
            } else {  // both side got lines to be renderend
                let in_row_keys = in_rows[in_count].key.split('/').slice(1);
                let out_row_keys = out_rows[out_count].key.split('/').slice(1);
                let render_line_in = true, render_line_out = true;
                // Check if which line should NOT be rendered (in or out or none)
                for(let level = 0, end = Math.min(in_row_keys.length, out_row_keys.length); level < end && render_line_in && render_line_out; ++level){
                    let index_in = in_row_keys[level].match(/\[\d\]/g);
                    let index_out = out_row_keys[level].match(/\[\d\]/g);
                    if(index_in == null || (index_in != null && index_in.length === 0) ){
                        // line is not a block, something went wrong
                        throw new Error(`${in_rows[in_count]} should not have been selected : a row should be an indexed element (with [index] in its key)`)
                    }
                    if(index_out == null || (index_out != null && index_out.length === 0) ){
                        // line is not a block, something went wrong
                        throw new Error(`${out_rows[out_count]} should not have been selected : a row should be an indexed element (with [index] in its key)`)
                    }
                    let index_in_number = +(index_in[0].substr(1,index_in[0].length - 1));
                    let index_out_number = +(index_out[0].substr(1,index_out[0].length - 1));
                    if(index_in_number < index_out_number){
                        render_line_out = false;
                    } else if (index_in_number > index_out_number){
                        render_line_in = false;
                    }
                }
                if(render_line_in && render_line_out){
                    rows.push(
                        <tr key={`doc_leaf_${line_key}`}>
                            <td key={`doc_leaf_${line_key}_in`}>{out_rows[in_count].computeIsolatedReactNode({
                                    rendering_start_path:'/html[0]/body[0]',
                                    use_semantic_css:true,
                                    hovering_pathes:hovered_keys, 
                                    onMouseEnterCallback:this.isHoveringBox,
                                    onMouseLeaveCallback:this.isLeavingBox
                                })}</td>
                            <td key={`doc_leaf_${line_key}_out`}>{in_rows[out_count].computeIsolatedReactNode({
                                    rendering_start_path:'/html[0]/body[0]',
                                    use_semantic_css:true
                                })}</td>
                        </tr>
                    );
                    ++line_key;
                    ++in_count;
                    ++out_count;
                } else if (render_line_in){
                    rows.push(
                        <tr key={`doc_leaf_${line_key}`}>
                            <td key={`doc_leaf_${line_key}_out`}/>
                            <td key={`doc_leaf_${line_key}_in`}>{in_rows[in_count].computeIsolatedReactNode({
                                rendering_start_path:'/html[0]/body[0]',
                                use_semantic_css:true,
                                hovering_pathes:hovered_keys,
                                onMouseEnterCallback:this.isHoveringBox,
                                onMouseLeaveCallback:this.isLeavingBox
                                })}</td>
                        </tr>);
                    ++in_count;
                    ++line_key;
                } else {
                    rows.push(
                        <tr key={`doc_leaf_${line_key}`}>
                            <td key={`doc_leaf_${line_key}_out`}>{out_rows[out_count].computeIsolatedReactNode({
                                rendering_start_path:'/html[0]/body[0]',
                                use_semantic_css:true,
                                hovering_pathes:hovered_keys,
                                onMouseEnterCallback:this.isHoveringBox,
                                onMouseLeaveCallback:this.isLeavingBox
                                })}</td>
                            <td key={`doc_leaf_${line_key}_in`}/>
                        </tr>);
                    ++out_count;
                    ++line_key;
                }
            }
        }
        
        let i= 0;
        let remediation_list = this.props.remediations_stack.map((value:{range:BoxFragment,remediation:BoxRemediation}) => {
            return <li style={{listStyleType:"none",padding:"0"}}>
                <input type="checkbox" 
                        checked={this.props.remediations_stack[i].is_activated} 
                        onChange={()=>{this.onRemediationChange(i++)}}/>
                <label>Apply on block {value.range.block}</label> : <br/>{value.remediation.render()}</li>;
        });

        // on the result side, highlights fragment instead of boxes
        // on boxes hovering, 
        // check if the box is within a registered range (a range within the remediation stack)
        // if it is, higlight all the boxes in this range
        return (
            <Fragment>
                <section key="transfo_stack" className="transfo-stack" aria-label="Stack of transformations">
                    <header className="transfo-stack__head">Proposed remediations</header>
                    <p style={{margin:"0"}}><small>(use the checkboxes to activate or deactivate a remediation)</small></p>
                    <ul className="transfo-stack__list">{remediation_list}</ul>
                </section>
                <section key="documents" className="documents">
                    <table style={{width:"100%"}}>
                        <thead>
                            <tr>
                                <th>Remediations result</th>
                                <th>Original structure</th>
                            </tr>
                        </thead>
                    </table>
                    <section className="scrolltable">
                        <table style={{width:"100%"}}>
                            <tbody>
                                {rows}
                            </tbody>
                        </table>
                    </section>
                </section>
            </Fragment>);
    }
}
