package com.izcad.viewer;

import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import java.io.File;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

public class DxfBlockPrunerTest {
    @Rule public TemporaryFolder folder = new TemporaryFolder();
    private String block(String name, String content) { return "0\nBLOCK\n2\n"+name+"\n"+content+"0\nENDBLK\n"; }
    private String insert(String name) { return "0\nINSERT\n2\n"+name+"\n"; }
    private String document(String blocks, String entities) { return "0\nSECTION\n2\nBLOCKS\n"+blocks+"0\nENDSEC\n0\nSECTION\n2\nENTITIES\n"+entities+"0\nENDSEC\n0\nEOF\n"; }
    private String prune(String source, int retained) throws Exception {
        File input=folder.newFile(),output=folder.newFile(); byte[] original=source.getBytes(StandardCharsets.UTF_8);Files.write(input.toPath(),original);
        DxfBlockPruner.Result result=DxfBlockPruner.prune(input,output);assertEquals(retained,result.retained);assertArrayEquals(original,Files.readAllBytes(input.toPath()));return new String(Files.readAllBytes(output.toPath()),StandardCharsets.UTF_8);
    }
    @Test public void preservesNestedModelAndDimensionReferencesAndAllOtherBytes() throws Exception {
        String a=block("A",insert("child")),child=block("child","0\nLINE\n10\n100.123456789\n"),dimension=block("*D1","0\nTEXT\n1\n한글 치수\n"),unused=block("unused",insert("other"));
        String root=insert("A")+"0\nDIMENSION\n2\n*D1\n";
        assertEquals(document(a+child+dimension,root),prune(document(a+unused+child+dimension,root),3));
    }
    @Test public void retainsCyclicReferencesWithoutLoopingAndCopiesUnicodeCrLf() throws Exception {
        String wanted=block("한글A",insert("B"))+block("B",insert("한글A")),root=insert("한글A");
        assertEquals(document(wanted,root).replace("\n","\r\n"),prune(document(wanted+block("unused",""),root).replace("\n","\r\n"),2));
    }
    @Test public void keepsModelAndPaperSpaceRoots() throws Exception {
        String wanted=block("*Model_Space",insert("child"))+block("*Paper_Space","")+block("child","");
        assertEquals(document(wanted,""),prune(document(wanted+block("unused",""),""),3));
    }
    @Test public void preservesDuplicateDefinitionsAndBothDependencyTrees() throws Exception {
        String wanted=block("same",insert("first"))+block("same",insert("second"))+block("first","")+block("second","");
        assertEquals(document(wanted,insert("same")),prune(document(wanted+block("unused",""),insert("same")),4));
    }
    @Test public void rejectsIncompleteDefinitionsInsteadOfDroppingVisibleContent() throws Exception {
        try { prune("0\nSECTION\n2\nBLOCKS\n0\nBLOCK\n2\nA\n0\nEOF\n",1); fail(); }catch(java.io.IOException expected){}
    }
    @Test public void preservesUnicodeAndCrLfAcrossInputBufferBoundaries() throws Exception {
        String kept=block("한글", "0\nTEXT\n1\n"+"가나다".repeat(50000)+"\n"),root=insert("한글");
        for(int shift=-1;shift<=1;shift++) {
            String prefix="0\r\nSECTION\r\n2\r\nHEADER\r\n1\r\n";
            String header=prefix+"x".repeat(256*1024-prefix.length()-1+shift)+"\r\n0\r\nENDSEC\r\n";
            assertEquals(header+document(kept,root).replace("\n","\r\n"),prune(header+document(kept+block("unused",""),root).replace("\n","\r\n"),1));
        }
    }
    @Test public void keepsLongBlockReferencesAndDocumentsWithoutFinalNewline() throws Exception {
        String name="큰이름".repeat(35000),wanted=block(name,""),root=insert(name);
        String expected=document(wanted,root).replace("\n","\r").stripTrailing();
        String input=document(wanted+block("unused",""),root).replace("\n","\r").stripTrailing();
        assertEquals(expected,prune(input,1));
        String padded=document(wanted,root).replace("\n2\n","\n +2 \n");
        assertEquals(padded,prune(padded,1));
    }
    @Test public void rejectsBadCodesAndTruncatedSkippedValues() throws Exception {
        for(String source:new String[]{"1x\nignored\n0\nEOF\n","2147483648\nignored\n0\nEOF\n","0\nSECTION\n2\nENTITIES\n10\n"}) {
            try { prune(source,0); fail("Accepted malformed DXF"); } catch(java.io.IOException expected){}
        }
    }
}
