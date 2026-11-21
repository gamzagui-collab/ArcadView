package com.izcad.viewer;
import org.junit.Test;
import static org.junit.Assert.*;

public class ExportFileRulesTest {
    @Test public void keepsKoreanNameAndXlsxExtension() { assertEquals("현장_물량집계.xlsx", ExportFileRules.safeName("현장_물량집계.xlsx")); }
    @Test public void removesPathSeparatorsAndControlCharacters() { assertEquals("a_b_c_집계.xlsx", ExportFileRules.safeName("a/b\\c\n집계.xlsx")); }
    @Test public void boundsLongNamesAndPreservesExtension() { String name=ExportFileRules.safeName(new String(new char[300]).replace('\0','가')+".xlsx");assertEquals(175,name.length());assertTrue(name.endsWith(".xlsx")); }
    @Test public void requiresSpreadsheetExtension() { try {ExportFileRules.safeName("source.dwg");fail();}catch(IllegalArgumentException expected){} }
    @Test public void rejectsMissingName() { try {ExportFileRules.safeName(null);fail();}catch(IllegalArgumentException expected){} }
    @Test public void rejectsInvalidOrOversizedArchive() {assertFalse(ExportFileRules.validArchive(null));assertFalse(ExportFileRules.validArchive(new byte[]{1,2,3,4}));byte[] big=new byte[ExportFileRules.MAX_BYTES+1];big[0]='P';big[1]='K';big[2]=3;big[3]=4;assertFalse(ExportFileRules.validArchive(big));}
    @Test public void acceptsBoundedZipSignature() {assertTrue(ExportFileRules.validArchive(new byte[]{'P','K',3,4,1}));assertTrue(ExportFileRules.MAX_BASE64_CHARS>=ExportFileRules.MAX_BYTES*4/3);}
}
