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
    remediations_stack:Array<{range:BoxFragment,remediation:BoxRemediation}>,
    css_stylesheet?:string

}

interface RemediatedContentViewState{
    last_hovered_key:string|undefined,
    selected_key:string|undefined,
    displayed_result:Box
}

export default class RemediatedContentView extends React.Component<RemediatedContentViewProperties,RemediatedContentViewState>{

    constructor(props:RemediatedContentViewProperties){
        super(props);
        let result = this.props.displayed_root;
        this.props.remediations_stack.forEach((value:{range:BoxFragment,remediation:BoxRemediation}) => {
            result = value.remediation.applyOn(result,value.range);
        });
        
        this.state = {
            last_hovered_key:"",
            selected_key:"",
            displayed_result:result
        };
        this.isHoveringBox = this.isHoveringBox.bind(this);
        this.isLeavingBox = this.isLeavingBox.bind(this);
    }
    
    isHoveringBox(key:string){
        this.setState({
            last_hovered_key:key
        });
    }

    isLeavingBox(key:string){
        let elements = key.split('/');
        let new_key = elements.slice(0,elements.length - 1).join("/");

        this.setState({
            last_hovered_key:new_key.length > "/html[0]/body[0]".length ? new_key:undefined
        });
    }

    isSelectingBox(key:string){
        // TODO : 
        // Add a "new transformation" button when one or more boxes are selected
        // (when a key)
        // check if ctrl or shift is pressed to allow selective 
        this.setState({
            selected_key:key
        });
        
    }


    /**
     * From a given box, compute the array of boxes that are blocks with only inlined (or aligned on a single line) children (like p or tr)
     * @param b 
     */
    private static computeBoxRows(b:Box){
        let box_rows = new Array<Box>();
        let boxes_queue = new Array<Box>();
        boxes_queue.push(b);
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
        let out_rows = RemediatedContentView.computeBoxRows(this.state.displayed_result);
        
        let rows = new Array<JSX.Element>();
        let in_count = 0, out_count = 0,line_key = 0;
        let hovered_key = this.state.last_hovered_key;
       
        while(in_count < in_rows.length || out_count < out_rows.length ){
            if(in_count >= in_rows.length){ // no more input line to render
                // only render output line
                rows.push(
                    <tr key={`doc_leaf_${line_key}`}>
                        <td key={`doc_leaf_${line_key}_out`}>{out_rows[out_count].computeIsolatedReactNode({
                            rendering_start_path:'/html[0]/body[0]',
                            use_semantic_css:true,
                            hovering_path:hovered_key,
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
                            hovering_path:hovered_key,
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
                                    hovering_path:hovered_key, 
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
                                hovering_path:hovered_key,
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
                                hovering_path:hovered_key,
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
        
        let remediation_list = this.props.remediations_stack.map((value:{range:BoxFragment,remediation:BoxRemediation}) => {
            return <li> On block {value.range.startBlockIndex} : <br/>{value.remediation.render()}</li>;
        });

        // on the result side, highlights fragment instead of boxes
        // on boxes hovering, 
        // check if the box is within a registered range (a range within the remediation stack)
        // if it is, higlight all the boxes in this range
        return (
            <Fragment>
                <section key="transfo_stack" className="transfo-stack" aria-label="Stack of transformations">
                    <header className="transfo-stack__head">Actions done</header>
                    <ul className="transfo-stack__list">{remediation_list}</ul>
                </section>
                <section key="documents" className="documents">
                    <table style={{width:"100%"}}>
                        <thead>
                            <tr>
                                <th>Remediation result</th>
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

/*

if(in_rows[in_count].key === out_rows[out_count].key){
                rows.push(
                    <tr key={`doc_leaf_${line_key}`}>
                        <td key={`doc_leaf_${line_key}_in`}>{out_rows[in_count].computeIsolatedReactNode({
                                rendering_start_path:'/html[0]/body[0]',
                                use_semantic_css:true,
                                hovering_path:hovered_key, 
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
            }else{
                // Check if one or more keys have been deleted from the input in the output
                // ==> check if the current output key exists somewhere after in the input
                let searched_key = out_rows[out_count].key;
                let key_found = -1;
                for(let i = in_count, end=in_rows.length; i < end || key_found > -1; ++i ){
                    if(in_rows[i].key === searched_key){
                        key_found = i;
                    }
                }
                
                if(key_found < 0){ // if key is not found in the input
                    // this is a new element that is not in the input
                    // Render an empty node in input and the node for the output
                    rows.push(
                        <tr key={`doc_leaf_${line_key}`}>
                            <td key={`doc_leaf_${line_key}_out`}>{out_rows[out_count].computeIsolatedReactNode({
                                rendering_start_path:'/html[0]/body[0]',
                                use_semantic_css:true,
                                hovering_path:hovered_key,
                                onMouseEnterCallback:this.isHoveringBox,
                                onMouseLeaveCallback:this.isLeavingBox
                                })}</td>
                            <td key={`doc_leaf_${line_key}_in`}/>
                        </tr>);
                    ++out_count;
                    ++line_key;
                } else { // The key has been found in the input later,
                    // some element may have been deleted in the output 
                    // Render the input boxes missing from output, whith empty elements in the output
                    for(let i = in_count, end = key_found; i < end; ++i){
                        rows.push(
                            <tr key={`doc_leaf_${line_key}`}>
                                <td key={`doc_leaf_${line_key}_out`}/>
                                <td key={`doc_leaf_${line_key}_in`}>{in_rows[i].computeIsolatedReactNode({
                                    rendering_start_path:'/html[0]/body[0]',
                                    use_semantic_css:true,
                                    hovering_path:hovered_key,
                                    onMouseEnterCallback:this.isHoveringBox,
                                    onMouseLeaveCallback:this.isLeavingBox
                                    })}</td>
                            </tr>);
                        ++in_count;
                        ++line_key;
                    }

                }
            } 

            */