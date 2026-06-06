import java.io.File
import java.io.IOException
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.logging.Logger
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.TaskAction

open class BuildTask : DefaultTask() {
    @Input
    var rootDirRel: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null
    @Internal
    var projectDir: File? = null
    @Internal
    var taskLogger: Logger? = null

    @TaskAction
    fun assemble() {
        val executable = """pnpm""";
        try {
            runTauriCli(executable)
        } catch (e: Exception) {
            if (Os.isFamily(Os.FAMILY_WINDOWS)) {
                // Try different Windows-specific extensions
                val fallbacks = listOf(
                    "$executable.exe",
                    "$executable.cmd",
                    "$executable.bat",
                )
                
                var lastException: Exception = e
                for (fallback in fallbacks) {
                    try {
                        runTauriCli(fallback)
                        return
                    } catch (fallbackException: Exception) {
                        lastException = fallbackException
                    }
                }
                throw lastException
            } else {
                throw e;
            }
        }
    }

    fun runTauriCli(executable: String) {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")
        val projectDir = projectDir ?: throw GradleException("projectDir cannot be null")
        val taskLogger = taskLogger ?: throw GradleException("taskLogger cannot be null")
        val args = listOf("tauri", "android", "android-studio-script");

        try {
            val processBuilder = ProcessBuilder(listOf(executable) + args + 
                if (taskLogger.isEnabled(LogLevel.DEBUG)) listOf("-vv") 
                else if (taskLogger.isEnabled(LogLevel.INFO)) listOf("-v") 
                else emptyList<String>() +
                if (release) listOf("--release") else emptyList<String>() +
                listOf("--target", target))
            processBuilder.directory(File(projectDir, rootDirRel))
            processBuilder.inheritIO()
            val process = processBuilder.start()
            val exitCode = process.waitFor()
            if (exitCode != 0) {
                throw GradleException("Command failed with exit code $exitCode")
            }
        } catch (e: IOException) {
            throw GradleException("Failed to execute command", e)
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            throw GradleException("Command interrupted", e)
        }
    }
}
