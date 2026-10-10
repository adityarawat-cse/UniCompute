package edu.unicompute.api;
/*package edu.unicompute.api; says which Java package this class belongs to. It should match the folders above the file. */
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class UniComputeApplication {

    public static void main(String[] args) {
        SpringApplication.run(UniComputeApplication.class, args);
    }
}