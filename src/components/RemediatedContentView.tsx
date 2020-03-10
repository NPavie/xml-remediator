import React, { Fragment } from "react";
import { Box, BoxType, ContentCSS, Rendering } from './Box';

import "./RemediatedContentView.css";

import "../css/html5-semantic-classes.css";
import BoxRemediation from "./BoxRemediation";
import BoxFragment from "./BoxFragment";
import Transformer from "./Transformer";


/**
 * 
 */
interface RemediatedContentViewProperties{
    selectionCallback?:(selected_key:string)=>void,
    displayed_root:Box,
    displayed_result:Box,
    remediations_stack:Array<{range:BoxFragment,remediation:BoxRemediation, is_activated:boolean}>,
    onRemediationChangeCallback?:(stack_index:number)=>void,
    content_css:ContentCSS,
    fragments_root_keys?: Array<Array<string>>,
    fragments_result_keys?: Array<Array<string>>

}

interface RemediatedContentViewState{
    
    hovered_fragment:BoxFragment | null,
    selected_keys:Array<string>,
    hovered_fragment_index?:number,
    applied_remediations:Array<{range:BoxFragment,remediation:BoxRemediation, id:number}>,
    available_remediations:Array<{range:BoxFragment,remediation:BoxRemediation, id:number}>
}

export default class RemediatedContentView extends React.Component<RemediatedContentViewProperties,RemediatedContentViewState>{

    

    constructor(props:RemediatedContentViewProperties){
        super(props);

        let applied_remediations = new Array<{range:BoxFragment,remediation:BoxRemediation, id:number}>();
        this.props.remediations_stack.forEach((value,index)=>{
            if(value.is_activated){
                applied_remediations.push({range:value.range, remediation:value.remediation,id:index});
            }
        });

        let available_remediations = new Array<{range:BoxFragment,remediation:BoxRemediation, id:number}>();
        this.props.remediations_stack.forEach((value,index)=>{
            if(!value.is_activated){
                available_remediations.push({range:value.range, remediation:value.remediation,id:index});
            }
        });

        this.state = {
            hovered_fragment: null,
            
            selected_keys:[],
            applied_remediations:applied_remediations,
            available_remediations:available_remediations,
        };

        // bound callbacks for sub components calls
        this.isHoveringBox = this.isHoveringBox.bind(this);
        this.isLeavingBox = this.isLeavingBox.bind(this);
    }

    /**
     * Called when hovering a box in a document
     * @param key 
     */
    isHoveringBox(key:string, is_result_key?:boolean){
        let hovered_fragment = null;
        let selected_document = is_result_key ? this.props.displayed_result : this.props.displayed_root;
        let transformer = new Transformer(selected_document);
        let fragment_found = transformer.getFragmentFromKey(key);
        if(fragment_found.isPresent()){
            hovered_fragment = fragment_found.value!;
        }
        
        this.setState({
            hovered_fragment:hovered_fragment
        });
    }

    /**
     * Called when leaving a box in a document
     * @param key 
     */
    isLeavingBox(key:string, is_result_key?:boolean){
        let selected_document = is_result_key ? this.props.displayed_result : this.props.displayed_root;

        let elements = key.split('/');
        
        let hovered_box = undefined
        do{
            elements = elements.slice(0,elements.length - 1);
            let new_key = elements.join("/");
            hovered_box = selected_document.selectBox(new_key);
        } while(hovered_box === undefined || hovered_box.rendering !== Rendering.DEFAULT)
        
        let hovered_key = hovered_box !== undefined ? hovered_box.key : "";
        let hovered_fragment = null;
        if(hovered_key.length > "/html[0]/body[0]".length){
            let transformer = new Transformer(selected_document);
            let fragment_found = transformer.getFragmentFromKey(hovered_key);
            if(fragment_found.isPresent()){
                hovered_fragment = fragment_found.value!;
            }
        }

        this.setState({
            hovered_fragment:hovered_fragment
        });
    }

    /**
     * 
     * @param remediation_index 
     */
    isHoveringRange(hovered_range:BoxFragment){
        
        this.setState({
            hovered_fragment:hovered_range,
        });
        

    }

    getRemediationHoveredKeys(remediation_index:number){
        if(this.props.fragments_result_keys != null && this.props.fragments_root_keys != null){
            let hovered_keys = this.props.fragments_root_keys[remediation_index].slice();
            this.props.fragments_result_keys[remediation_index].forEach((key)=>{
                let key_not_found = true;
                for(let i = 0, end = hovered_keys.length; i < end && key_not_found; i++){
                    key_not_found = (key !== hovered_keys[i]);
                }
                if(key_not_found) hovered_keys.push(key);
            });
            return hovered_keys;
        } else return [];
    }

    

    isLeavingRange(){
        // Delete hovered stack key content
        this.setState({
            hovered_fragment:null
        });
    }

    isSelectingBox(key:string){
        // TODO : Add a "new remediation" button when one or more boxes are selected
        // TODO : check if ctrl or shift is pressed for multibox or range selection ?
        this.setState({
            selected_keys:[key]
        });
        
    }

    /**
     * block-level remediation checkbox callback
     * @param remediation_index 
     */
    onRemediationChange(remediation_index:number){
        if(this.props.onRemediationChangeCallback) this.props.onRemediationChangeCallback(remediation_index);
    }

    onRemediationRemove(applied_remediation_index:number){
        let remediation = this.state.applied_remediations.splice(applied_remediation_index,1)[0];
        this.state.available_remediations.push(remediation);
        this.setState({
            available_remediations:this.state.available_remediations.slice(),
            applied_remediations:this.state.applied_remediations.slice(),
        });
        if(this.props.onRemediationChangeCallback) this.props.onRemediationChangeCallback(remediation.id);
        
    }

    onRemediationApply(available_remediation_index:number){
        let remediation = this.state.available_remediations.splice(available_remediation_index,1)[0];
        this.state.applied_remediations.push(remediation);
        this.setState({
            available_remediations:this.state.available_remediations.slice(),
            applied_remediations:this.state.applied_remediations.slice(),
        });
        if(this.props.onRemediationChangeCallback) this.props.onRemediationChangeCallback(remediation.id);
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
        // recompute fragments keys
        //this.fragments_root_keys = this.computeFragmentsKeys(this.props.displayed_root);
        //this.fragments_result_keys = this.computeFragmentsKeys(this.props.displayed_result);
        
        // for each box, compute the array of "lowest block box"
        let in_rows = RemediatedContentView.computeBoxRows(this.props.displayed_root);
        let out_rows = RemediatedContentView.computeBoxRows(this.props.displayed_result);
        
        let rows = new Array<JSX.Element>();
        let in_count = 0, out_count = 0,line_key = 0;
        //let hovered_keys = this.state.hovered_fragment_index ? 
        //    this.getRemediationHoveredKeys(this.state.hovered_fragment_index) : 
        //    this.state.last_hovered_keys;
        // TODO : recompute hovered keys from the ne hovered fragments list
        //console.log(this.state.hovered_fragments);
        let hovered_fragment = this.state.hovered_fragment;
        
        let hovered_keys = new Array<string>();
        if(hovered_fragment != null){
            // keys of the root document
            hovered_keys = new Transformer(this.props.displayed_root).moveTo(
                hovered_fragment.block,hovered_fragment.size,hovered_fragment.inline
            ).getFragmentKeys();
            
            // + keys of the remediated document
            new Transformer(this.props.displayed_result).moveTo(
                hovered_fragment.block,hovered_fragment.size,hovered_fragment.inline
            ).getFragmentKeys().forEach((value)=>{
                hovered_keys.push(value);
            });
            //console.log(hovered_keys);
        }

        while(in_count < in_rows.length || out_count < out_rows.length ){
            if(in_count >= in_rows.length){ // no more input line to render
                // only render output line
                rows.push(
                    <tr key={`doc_leaf_${line_key}`}>
                        <td style={{verticalAlign:"top"}} key={`doc_leaf_${line_key}_out`}>{out_rows[out_count].computeIsolatedReactNode({
                            rendering_start_path:'/html[0]/body[0]',
                            use_semantic_css:this.props.content_css === ContentCSS.SEMANTIC,
                            hovering_pathes:hovered_keys,
                            onMouseEnterCallback:(key:string)=>{this.isHoveringBox(key,true)},
                            onMouseLeaveCallback:(key:string)=>{this.isLeavingBox(key,true)}
                            })}</td>
                        <td style={{verticalAlign:"top"}} key={`doc_leaf_${line_key}_in`}/>
                    </tr>);
                ++out_count;
                ++line_key;
            } else if (out_count >= out_rows.length){ // no more output line to render
                // only render input line
                rows.push(
                    <tr key={`doc_leaf_${line_key}`}>
                        <td style={{verticalAlign:"top"}} key={`doc_leaf_${line_key}_out`}/>
                        <td style={{verticalAlign:"top"}} key={`doc_leaf_${line_key}_in`}>{in_rows[in_count].computeIsolatedReactNode({
                            rendering_start_path:'/html[0]/body[0]',
                            use_semantic_css:this.props.content_css === ContentCSS.SEMANTIC,
                            hovering_pathes:hovered_keys,
                            onMouseEnterCallback:(key:string)=>{this.isHoveringBox(key,false)},
                            onMouseLeaveCallback:(key:string)=>{this.isLeavingBox(key,false)}
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
                            <td style={{verticalAlign:"top"}} key={`doc_leaf_${line_key}_in`}>{out_rows[in_count].computeIsolatedReactNode({
                                    rendering_start_path:'/html[0]/body[0]',
                                    use_semantic_css:this.props.content_css === ContentCSS.SEMANTIC,
                                    hovering_pathes:hovered_keys, 
                                    onMouseEnterCallback:(key:string)=>{this.isHoveringBox(key,true)},
                                    onMouseLeaveCallback:(key:string)=>{this.isLeavingBox(key,true)}
                                })}</td>
                            <td style={{verticalAlign:"top"}} key={`doc_leaf_${line_key}_out`}>{in_rows[out_count].computeIsolatedReactNode({
                                    rendering_start_path:'/html[0]/body[0]',
                                    hovering_pathes:hovered_keys,
                                    use_semantic_css:this.props.content_css === ContentCSS.SEMANTIC,
                                    onMouseEnterCallback:(key:string)=>{this.isHoveringBox(key,false)},
                                    onMouseLeaveCallback:(key:string)=>{this.isLeavingBox(key,false)}
                                })}</td>
                        </tr>
                    );
                    ++line_key;
                    ++in_count;
                    ++out_count;
                } else if (render_line_in){
                    rows.push(
                        <tr key={`doc_leaf_${line_key}`}>
                            <td style={{verticalAlign:"top"}} key={`doc_leaf_${line_key}_out`}/>
                            <td style={{verticalAlign:"top"}} key={`doc_leaf_${line_key}_in`}>{in_rows[in_count].computeIsolatedReactNode({
                                    rendering_start_path:'/html[0]/body[0]',
                                    use_semantic_css:this.props.content_css === ContentCSS.SEMANTIC,
                                    hovering_pathes:hovered_keys,
                                    onMouseEnterCallback:(key:string)=>{this.isHoveringBox(key,false)},
                                    onMouseLeaveCallback:(key:string)=>{this.isLeavingBox(key,false)}
                                })}</td>
                        </tr>);
                    ++in_count;
                    ++line_key;
                } else {
                    rows.push(
                        <tr key={`doc_leaf_${line_key}`}>
                            <td style={{verticalAlign:"top"}} key={`doc_leaf_${line_key}_out`}>{out_rows[out_count].computeIsolatedReactNode({
                                rendering_start_path:'/html[0]/body[0]',
                                use_semantic_css:this.props.content_css === ContentCSS.SEMANTIC,
                                hovering_pathes:hovered_keys,
                                onMouseEnterCallback:(key:string)=>{this.isHoveringBox(key,true)},
                                onMouseLeaveCallback:(key:string)=>{this.isLeavingBox(key,true)}
                                })}</td>
                            <td style={{verticalAlign:"top"}} key={`doc_leaf_${line_key}_in`}/>
                        </tr>);
                    ++out_count;
                    ++line_key;
                }
            }
        }
        /* <input type="checkbox" 
                                checked={this.props.remediations_stack[index].is_activated} 
                                onChange={()=>{this.onRemediationChange(index)}}/>
        */
        let applied_remediations_list = this.state.applied_remediations.map(
                (value:{range:BoxFragment,remediation:BoxRemediation},index:number) => {
                    return <li style={{listStyleType:"none",padding:"0"}} 
                            onMouseEnter={()=>this.isHoveringRange(value.range)}
                            onMouseLeave={()=>{this.isLeavingRange()}}>
                        <button style={{marginRight:"10px", padding:"1px"}} onClick={()=>{this.onRemediationRemove(index)}}>Remove</button>
                        <label>On block {value.range.block}</label> : <br/>{value.remediation.render(this.props.remediations_stack[index].is_activated)}</li>;
                });
        let available_remediations_list = this.state.available_remediations.map(
                (value:{range:BoxFragment,remediation:BoxRemediation},index:number) => {
                    return <li style={{listStyleType:"none",padding:"0"}} 
                            onMouseEnter={()=>this.isHoveringRange(value.range)}
                            onMouseLeave={()=>{this.isLeavingRange()}}>
                        <button style={{marginRight:"10px", padding:"1px"}}  onClick={()=>{this.onRemediationApply(index)}}>Apply</button>
                        <label>On block {value.range.block}</label> : <br/>{value.remediation.render(this.props.remediations_stack[index].is_activated)}</li>;
                });

        // on the result side, highlights fragment instead of boxes
        // on boxes hovering, 
        // check if the box is within a registered range (a range within the remediation stack)
        // if it is, higlight all the boxes in this range
        
        return (
            <Fragment>
                <section key="transfo_stack" className="transfo-stack" aria-label="Remediations suggestions">
                    
                    <section key="applied_transformations" style={{height:"50%"}}>
                        <header className="transfo-stack__head">Applied remediations</header>
                        <ul className="transfo-stack__list">{applied_remediations_list}</ul>
                    </section>
                    <section key="available_transformations" style={{height:"50%"}}>
                        <header className="transfo-stack__head">Available remediations</header>
                        <ul className="transfo-stack__list">{available_remediations_list}</ul>
                    </section>
                </section>
                <section key="documents" className="documents" aria-label="Remediations preview" aria-description="test">
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
