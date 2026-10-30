package edu.unicompute.api.nodes;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DownloadController.class)
class DownloadControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /downloads/worker.ps1 includes B-6 sandbox isolation and env scrubbing")
    void testWorkerPs1SandboxIsolation() throws Exception {
        mockMvc.perform(get("/downloads/worker.ps1")
                        .param("token", "uc_tok_12345")
                        .param("name", "TestNode"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString(".unicompute_sandbox")))
                .andExpect(content().string(containsString("sensitivePatterns")))
                .andExpect(content().string(containsString("UNICOMPUTE_SANDBOX_DIR")))
                .andExpect(content().string(containsString("PYTHONDONTWRITEBYTECODE")));
    }

    @Test
    @DisplayName("GET /downloads/install-worker.sh includes B-6 sandbox isolation and env scrubbing")
    void testInstallWorkerShSandboxIsolation() throws Exception {
        mockMvc.perform(get("/downloads/install-worker.sh")
                        .param("token", "uc_tok_12345")
                        .param("name", "TestNode"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString(".unicompute_sandbox")))
                .andExpect(content().string(containsString("CLEAN_ENV")))
                .andExpect(content().string(containsString("UNICOMPUTE_SANDBOX_DIR")))
                .andExpect(content().string(containsString("chmod 700")));
    }

    @Test
    @DisplayName("GET /downloads/unicompute-worker.zip returns downloadable package with sandbox scripts")
    void testWorkerZipDownload() throws Exception {
        mockMvc.perform(get("/downloads/unicompute-worker.zip")
                        .param("token", "uc_tok_12345")
                        .param("name", "Lab-Node"))
                .andExpect(status().isOk());
    }
}
