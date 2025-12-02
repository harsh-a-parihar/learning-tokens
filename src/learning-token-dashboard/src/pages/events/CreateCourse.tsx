import { Form, Formik } from "formik";
import { useEffect, useRef, useState } from "react";
import { array, object, string } from "yup";
import TextInput from "../../components/TextInput";
import { Container, Row, Col, Button, Card } from "react-bootstrap";
import { RootState } from "../../store";
import { useSelector } from "react-redux";
import axios from "axios";
import { SuccessModal } from "../../components/Modal/SuccessModal";
import { useEventContext } from "../../contexts/EventContext";
import { useParams } from "react-router-dom";

const validationSchema = object().shape({
  courseName: string().required("Course Name is required."),
  learnersList: array().min(1).required("At least 1 learner should be added"),
});

const CreateCourse = () => {
  const { id } = useParams();
  const formikRef = useRef<any>(null);
  const auth = useSelector((state: RootState) => state.auth);
  const [learnersList, setLearnersList] = useState([]);
  const [filteredLearnersList, setFilteredLearnersList] = useState([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [formEditable, setFormEditable] = useState(true);
  const [modalMessage, setModalMessage] = useState("");
  const { eventData, setEventData } = useEventContext();

  // 1. Fetch Event Data (Always fetch to ensure fresh status)
  useEffect(() => {
    const fetchEventData = async () => {
      if (id) {
        try {
          console.log(`[CreateCourse] Fetching fresh event data for ID: ${id}`);
          const response = await axios.get(`${import.meta.env.VITE_API_URL}/event/${id}`, {
            headers: {
              Authorization: `Bearer ${auth.accessToken}`,
            },
          });
          console.log('[CreateCourse] Event data fetched:', response.data);
          setEventData(response.data);
        } catch (error) {
          console.error("[CreateCourse] Error fetching event data:", error);
        }
      }
    };

    fetchEventData();
  }, [id, auth.accessToken, setEventData]);

  // 2. Check status to disable form
  useEffect(() => {
    if (eventData?.eventName && learnersList.length > 0 && eventData?.status !== "reviewWallets") {
      // If status is NOT reviewWallets (e.g. it's tokenDistribution or completed), disable form
      // Wait, if we are IN reviewWallets step, form should be editable unless already created?
      // Actually logic should be: if course is already created, disable.
      // Let's assume 'reviewWallets' is the current active step. 
      // If we moved past it, disable.
      
      // Better check: if onlineEvent.courseCreateStatus is true
      if (eventData?.onlineEvent?.courseCreateStatus) {
         setFormEditable(false);
      }
    }
  }, [eventData, learnersList.length]);

  // 3. Fetch Learners List (Depends on eventData)
  useEffect(() => {
    const fetchLearnersList = async () => {
      // Guard: Only proceed if we have a numeric ID from eventData
      if (!eventData?.id) {
        console.log("[CreateCourse] Waiting for eventData ID...");
        return; 
      }

      try {
        // Fetch all learners (Admin)
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/admin/learner-list`, {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        });

        const allLearners = response?.data?.result?.data || [];
        setLearnersList(allLearners);
        
        // Fetch learners associated with this event (Postevent)
        // Use the numeric ID from eventData
        console.log(`[CreateCourse] Fetching post-events for event ID: ${eventData.id}`);
        const eventResponse = await axios.get(`${import.meta.env.VITE_API_URL}/postevent/${eventData.id}`);
        const eventLearnersEmails = eventResponse.data.map((learner: any) => learner.email);

        // Filter learnersList by the emails fetched from the event
        const filteredLearners = allLearners.filter((learner: any) =>
          eventLearnersEmails.includes(learner.email)
        );

        setFilteredLearnersList(filteredLearners);
      } catch (error) {
        console.error("[CreateCourse] Error fetching learners list:", error);
      }
    };

    fetchLearnersList();
  }, [auth.accessToken, eventData?.id]); // Depend on eventData.id

  const initialValues = {
    courseName: eventData?.eventName || "",
    learnersList: [],
  };

  const handleSubmit = async (values: any) => {
    console.log("Form Submitted with values:", values);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/smartcontract/create-course`, {
        courseName: values.courseName,
        preEventId: eventData.id,
      }, {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      });

      console.log(`response: ${response.data}`);

      if (response.status === 201) {
        const message = response.data.message || 'Course created successfully';
        setModalMessage(message);
        setModalVisible(true);
        setFormEditable(false);
        // Refresh event data to get updated courseCreateStatus
        if (eventData?.id) {
          try {
            const eventResponse = await axios.get(`${import.meta.env.VITE_API_URL}/preevent/${eventData.id}`, {
              headers: {
                Authorization: `Bearer ${auth.accessToken}`,
              },
            });
            // Update eventData in context if needed
          } catch (err) {
            console.error("Error refreshing event data:", err);
          }
        }
      }
    } catch (error: any) {
      console.error("Error creating course:", error);
      const errorMessage = error.response?.data?.message || 
                           error.response?.data?.error || 
                           error.message || 
                           'Failed to create course. Please try again.';
      setModalMessage(`Error: ${errorMessage}`);
      setModalVisible(true);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  return (
    <Container className="my-5">
      <Card>
        <Card.Body>
          <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            innerRef={formikRef}
            onSubmit={handleSubmit}
          >
            {({ values }) => (
              <Form>
                <Row className="mb-3">
                  <Col>
                    <h4>Event Name</h4>
                    <TextInput
                      name="courseName"
                      type="text"
                      containerStyle={`w-full`}
                      size="small"
                      disabled={!formEditable}
                    />
                  </Col>
                </Row>

                <h4>Instructor</h4>
                <Row className="mb-3">
                  <Col className="mb-2">
                    <div className="border p-2 text-center">
                      {auth.user.name} - {auth.user.publicAddress}
                    </div>
                  </Col>
                </Row>

                <h4>Learners List</h4>
                <Row className="mb-3">
                  {filteredLearnersList.map((learner: any) => (
                    <Col key={learner.id} className="mb-2">
                      <div className="border p-2 text-center">
                        {learner.name} - {learner.publicAddress}
                      </div>
                    </Col>
                  ))}
                </Row>

                <Button
                  size="sm"
                  className="mt-3"
                  variant="btn btn-outline-primary"
                  type="submit"
                  disabled={!formEditable}
                  onClick={() => handleSubmit(values)}
                >
                  Create Course
                </Button>
              </Form>
            )}
          </Formik>
        </Card.Body>
      </Card>

      <SuccessModal show={isModalVisible} message={modalMessage} onClose={closeModal} />
    </Container>
  );
};

export default CreateCourse;