// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
const audio=vi.hoisted(()=>({stop:vi.fn(),isActive:vi.fn(()=>true)}));
vi.mock('@agentiq/article-reader',()=>({theQriptopianStyleGuide:{}}));
vi.mock('../services/smartcontent/smartContentAudioController',()=>({useOptionalSmartContentAudio:()=>audio}));
vi.mock('../components/shared/SmartContentListenButton',()=>({SmartContentListenButton:({item}:any)=><button aria-label="Listen test" data-audio-id={item.id} onClick={()=>{(window as any).speech=item.getText()}}>Listen</button>}));
import ContentViewer from '../app/components/content/ContentViewer';
const content:any={id:'006',title:'Essay',app:'qriptopian',coverImageUri:'/broken.png',modalities:{read:{enabled:true,text:'# Essay\n\nResearch body [^1].\n\nResearch ending.',pdf_url:'/research.pdf',defaultEdition:'reading',editions:[{id:'reading',label:'Reading Edition',description:'Continuous prose',source:'inline',text:'# Essay\n\nReading body.\n\nReading ending.',pdf_url:'/reading.pdf'},{id:'research',label:'Research Edition',description:'References and audit trails',source:'canonical'}]}}};
afterEach(()=>{cleanup();vi.clearAllMocks()});
describe('edition selector in shared reader',()=>{
  it('defaults to Reading and switches the body, PDF and Listen together',()=>{
    render(<ContentViewer content={content} hasAccess accessScope="full"/>);
    expect(screen.getByText('Reading body.')).toBeTruthy();
    expect(screen.getByRole('link',{name:'Open Reading Edition PDF'}).getAttribute('href')).toBe('/reading.pdf');
    fireEvent.click(screen.getByRole('button',{name:'Listen test'}));
    expect((window as any).speech).toContain('Reading body');
    fireEvent.click(screen.getByRole('button',{name:'Research Edition'}));
    expect(audio.stop).toHaveBeenCalledOnce();
    expect(screen.getByText(/Research body/)).toBeTruthy();
    expect(screen.getByRole('link',{name:'Open Research Edition PDF'}).getAttribute('href')).toBe('/research.pdf');
    fireEvent.click(screen.getByRole('button',{name:'Listen test'}));
    expect((window as any).speech).toContain('Research body');
    expect(screen.getByRole('button',{name:'Listen test'}).getAttribute('data-audio-id')).toBe('006:edition:research');
    expect(screen.getAllByRole('heading',{name:'Essay',level:1})).toHaveLength(1);
  });
  it('keeps preview limits for both editions and hides full PDF downloads',()=>{
    render(<ContentViewer content={{...content,pricingModel:{freePreview:{paragraphs:2}}}}/>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('Reading ending.')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Research Edition'}));
    expect(screen.queryByText('Research ending.')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Listen test'}));
    expect((window as any).speech).not.toContain('Research ending');
  });
  it('resets the edition when changing publication and preserves legacy content',()=>{
    const {rerender}=render(<ContentViewer content={content} hasAccess/>);
    fireEvent.click(screen.getByRole('button',{name:'Research Edition'}));
    rerender(<ContentViewer content={{...content,id:'007'}} hasAccess/>);
    expect(screen.getByText('Reading body.')).toBeTruthy();
    rerender(<ContentViewer content={content} hasAccess/>);
    expect(screen.getByText('Reading body.')).toBeTruthy();
    rerender(<ContentViewer content={{...content,id:'005',modalities:{read:{text:'Original 005'}}}} hasAccess/>);
    expect(screen.queryByRole('group',{name:'Reading edition'})).toBeNull();
    expect(screen.getByText('Original 005')).toBeTruthy();
  });
  it('removes a failed cover without replacing it or blocking the article',()=>{
    render(<ContentViewer content={content} hasAccess/>);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Reading body.')).toBeTruthy();
  });
  it('does not stop playback belonging to another publication',()=>{
    audio.isActive.mockReturnValueOnce(false);
    render(<ContentViewer content={content} hasAccess/>);
    fireEvent.click(screen.getByRole('button',{name:'Research Edition'}));
    expect(audio.stop).not.toHaveBeenCalled();
  });
});
