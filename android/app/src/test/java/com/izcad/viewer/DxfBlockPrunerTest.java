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
}
