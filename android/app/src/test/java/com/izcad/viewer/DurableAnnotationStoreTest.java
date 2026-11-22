package com.izcad.viewer;

import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import static org.junit.Assert.*;
import java.io.File;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;

public class DurableAnnotationStoreTest {
    @Rule public TemporaryFolder temporary = new TemporaryFolder();
    @Test public void committedBytesSurviveNewStoreAndUnicode() throws Exception {
        File directory = temporary.newFolder();
        DurableAnnotationStore store = new DurableAnnotationStore(directory);
        String raw = "{\"text\":\"옹벽 주석 🏗\"}";
        store.write("drawing-A", raw);
        assertEquals(raw, new DurableAnnotationStore(directory).read("drawing-A"));
        assertEquals(1, directory.list().length);
        store.write("drawing-A", "updated");
        assertEquals("updated", new DurableAnnotationStore(directory).read("drawing-A"));
        assertEquals(1, directory.list().length);
    }
    @Test public void interruptedPendingFileNeverReplacesLastCommit() throws Exception {
        File directory = temporary.newFolder();
        DurableAnnotationStore store = new DurableAnnotationStore(directory);
        store.write("a", "confirmed");
        File completed = directory.listFiles()[0];
        File pending = new File(directory, completed.getName().replace(".json", ".pending"));
        Files.write(pending.toPath(), "partial".getBytes(StandardCharsets.UTF_8));
        assertEquals("confirmed", new DurableAnnotationStore(directory).read("a"));
        store.write("a", "next");
        assertFalse(pending.exists());
        assertEquals("next", new DurableAnnotationStore(directory).read("a"));
    }
    @Test public void missingAndDifferentKeysDoNotMixAndPathsAreHashed() throws Exception {
        File directory = temporary.newFolder();
        DurableAnnotationStore store = new DurableAnnotationStore(directory);
        assertNull(store.read("a"));
        store.write("../../outside", "a"); store.write("b", "b");
        assertEquals("a", store.read("../../outside")); assertEquals("b", store.read("b"));
        for (String name : directory.list()) assertTrue(name.matches("[a-f0-9]{64}\\.json"));
    }
    @Test public void failedWriteKeepsConfirmedFile() throws Exception {
        File directory = temporary.newFolder();
        DurableAnnotationStore store = new DurableAnnotationStore(directory);store.write("a", "confirmed");
        File completed = directory.listFiles()[0], pending = new File(directory, completed.getName().replace(".json", ".pending"));
        assertTrue(pending.mkdir());
        try { store.write("a", "failed"); fail("must report failed write"); } catch (Exception expected) { }
        assertEquals("confirmed", new DurableAnnotationStore(directory).read("a"));
    }
    @Test public void rejectsOversizedAndInvalidKeysWithoutReplacingData() throws Exception {
        DurableAnnotationStore store = new DurableAnnotationStore(temporary.newFolder());store.write("a", "confirmed");
        try { store.write("a", "x".repeat(4_000_001)); fail(); } catch (Exception expected) { }
        try { store.write("", "bad"); fail(); } catch (Exception expected) { }
        assertEquals("confirmed", store.read("a"));
    }
}
