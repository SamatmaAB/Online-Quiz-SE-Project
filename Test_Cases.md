# Test Cases – Online Quiz Management System

Project Name: Online Quiz Management System  
Document Version: 1.0  
Document Type: Software Testing Documentation

 1. Introduction

This document contains test cases for checking the main features of the Online Quiz Management System. The purpose is to verify that users can log in, view quizzes, answer questions, submit quizzes, and view their results correctly.

 2. Test Cases

| Test Case ID | Test Scenario | Test Steps | Expected Result |
|---|---|---|---|
| TC-01 | Login with valid credentials | Enter a valid username and password, then click Login. | User logs in successfully. |
| TC-02 | Login with invalid credentials | Enter an incorrect username or password. | An error message is displayed. |
| TC-03 | Login with empty fields | Leave the username and password empty and click Login. | Required-field validation is displayed. |
| TC-04 | View available quizzes | Log in and open the quiz section. | Available quizzes are displayed. |
| TC-05 | Open a quiz | Select a quiz and click View Quiz. | The selected quiz opens correctly. |
| TC-06 | Display quiz questions | Open a quiz containing multiple questions. | Questions and answer options are displayed correctly. |
| TC-07 | Select an answer | Choose an option for a question. | The selected answer is recorded. |
| TC-08 | Change an answer | Select one option, then select another option for the same question. | The latest selection is recorded. |
| TC-09 | Submit a quiz | Answer the questions and click Submit. | The quiz is submitted successfully. |
| TC-10 | Submit with unanswered questions | Leave some questions unanswered and submit the quiz. | The system follows its configured submission rules and handles unanswered questions correctly. |
| TC-11 | View quiz results | Submit a quiz and open the results page. | The result or score is displayed correctly. |
| TC-12 | Prevent duplicate submission | Submit a quiz, then attempt to submit it again. | The system prevents duplicate submission if that is the intended rule. |
| TC-13 | Handle invalid quiz access | Try opening a quiz using an invalid quiz ID or unavailable quiz link. | The system displays an appropriate error or access-denied message. |
| TC-14 | Validate user input | Enter unexpected or invalid input in supported form fields. | The system validates input and handles it safely. |
| TC-15 | Logout | Click the Logout button. | The user session ends and the user is redirected appropriately. |

 3. Test Execution Record

Use this table after actually running the test cases.

| Test Case ID | Actual Result | Status |
|---|---|---|
| TC-01 | To be filled after testing | Not Run |
| TC-02 | To be filled after testing | Not Run |
| TC-03 | To be filled after testing | Not Run |
| TC-04 | To be filled after testing | Not Run |
| TC-05 | To be filled after testing | Not Run |
| TC-06 | To be filled after testing | Not Run |
| TC-07 | To be filled after testing | Not Run |
| TC-08 | To be filled after testing | Not Run |
| TC-09 | To be filled after testing | Not Run |
| TC-10 | To be filled after testing | Not Run |
| TC-11 | To be filled after testing | Not Run |
| TC-12 | To be filled after testing | Not Run |
| TC-13 | To be filled after testing | Not Run |
| TC-14 | To be filled after testing | Not Run |
| TC-15 | To be filled after testing | Not Run |

 4. Conclusion

These test cases provide a structured way to verify the main functions of the Online Quiz Management System. Test results should be recorded after execution, and any failures should be investigated and corrected.

**Note:** Expected behavior must be checked against the actual project implementation. Mark a test as Passed or Failed only after executing it.