import React, { Fragment } from "react";
import Transformation from "./Transformation";
import { Box, BoxRenderMode, BoxType } from './Box';

import "./RemediatedContentView.css";

import "../css/html5-semantic-classes.css";


/**
 * 
 */
interface RemediatedContentViewProperties{
    selectionCallback?:(selected_key:string)=>void,
    displayed_root:Box,
    transformations_stack:Array<Transformation>,
    css_stylesheet?:string

}

interface RemediatedContentViewState{
    last_hovered_key:string|undefined,
    selected_key:string|undefined
}

export default class RemediatedContentView extends React.Component<RemediatedContentViewProperties,RemediatedContentViewState>{

    constructor(props:RemediatedContentViewProperties){
        super(props);
        this.state = {
            last_hovered_key:"",
            selected_key:""
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
        // Apply the transformations on the displayed_root
        let result_doc = this.props.displayed_root;
        // On the left, display the original content
        
        // for each box, compute the array of "lowest block box"
        let in_rows = RemediatedContentView.computeBoxRows(this.props.displayed_root);
        let out_rows = RemediatedContentView.computeBoxRows(result_doc);
        
        let rows = new Array<JSX.Element>();
        let in_count = 0, out_count = 0,line_key = 0;
        let hovered_key = this.state.last_hovered_key;
        //console.log(hovered_key);
        while(in_count < in_rows.length && out_count < out_rows.length ){
            // If both keys are identical
            if(in_rows[in_count].key === out_rows[out_count].key){
                rows.push(
                    <tr key={`doc_leaf_${line_key}`}>
                        <td key={`doc_leaf_${line_key}_in`}>{in_rows[in_count].computeIsolatedReactNode({
                            rendering_start_path:'/html[0]/body[0]',
                            use_semantic_css:true,
                            hovering_path:hovered_key, 
                            onMouseEnterCallback:this.isHoveringBox,
                            onMouseLeaveCallback:this.isLeavingBox
                            })}</td>
                        <td key={`doc_leaf_${line_key}_out`}>{out_rows[out_count].computeIsolatedReactNode({
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
                            <td key={`doc_leaf_${line_key}_in`}/>
                            <td key={`doc_leaf_${line_key}_out`}>{out_rows[out_count].computeIsolatedReactNode({
                                rendering_start_path:'/html[0]/body[0]',
                                use_semantic_css:true,
                                hovering_path:hovered_key,
                                onMouseEnterCallback:this.isHoveringBox,
                                onMouseLeaveCallback:this.isLeavingBox
                                })}</td>
                        </tr>);
                    ++out_count;
                    ++line_key;
                } else { // The key has been found in the input later,
                    // some element may have been deleted in the output 
                    // Render the input boxes missing from output, whith empty elements in the output
                    for(let i = in_count, end = key_found; i < end; ++i){
                        rows.push(
                            <tr key={`doc_leaf_${line_key}`}>
                                <td key={`doc_leaf_${line_key}_in`}>{in_rows[i].computeIsolatedReactNode({
                                    rendering_start_path:'/html[0]/body[0]',
                                    use_semantic_css:true,
                                    hovering_path:hovered_key,
                                    onMouseEnterCallback:this.isHoveringBox,
                                    onMouseLeaveCallback:this.isLeavingBox
                                    })}</td>
                                <td key={`doc_leaf_${line_key}_out`}/>
                            </tr>);
                        ++in_count;
                        ++line_key;
                    }

                }
            } 
        }
        //console.log(rows);
        return <Fragment>
            <section className="transfo-stack" aria-lable="Stack of transformations">
                <b>Transformations</b>
            </section>
            <section className="documents">
                <table style={{width:"100%"}}>
                    <thead>
                        <tr>
                            <th>Original structure</th>
                            <th>Remediation result</th>
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
            
        </Fragment>;
    }
}