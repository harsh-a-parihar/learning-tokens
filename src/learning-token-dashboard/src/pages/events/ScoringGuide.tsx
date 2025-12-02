import { Form, Formik, FormikProps } from "formik";
import { useRef, useState, useEffect } from "react";
import { number, object, string } from "yup";
import TextInput from "../../components/TextInput";
import { useParams } from "react-router-dom";
import { useEventContext } from "../../contexts/EventContext";
import { Container, Row, Col, Card, Table, Button } from "react-bootstrap";
import axios from "axios";
import { SuccessModal } from "../../components/Modal/SuccessModal";
import { useSelector } from "react-redux";
import { RootState } from "../../store";

const initialValues = {
  organizer: "",
  community: "",
  fieldsOfKnowledge: "",
  taxonomyOfSkills: "",
  attendanceToken: 0,
  learnerScoreToken: 0,
  helpTokenAmount: 0,
  instructorScoreToken: 0,
};

const validationSchema = object().shape({
  organizer: string().required("Organizer is required."),
  community: string().required("Community is required."),
  fieldsOfKnowledge: string().required("Fields Of Knowledge is required."),
  taxonomyOfSkills: string().required("Taxonomy Of Skills is required."),
  attendanceToken: number()
      .required("attendanceToken is required.")
      .min(1, "Attendance Token must be at least 1."),
  learnerScoreToken: number()
      .required("learnerScoreToken is required.")
      .min(1, "Attendance Token must be at least 1."),
  helpTokenAmount: number()
      .required("helpTokenAmount is required.")
      .min(1, "Attendance Token must be at least 1."),
  instructorScoreToken: number()
      .required("instructorScoreToken is required.")
      .min(1, "Attendance Token must be at least 1."),
});

const ScoringGuide = () => {
  const { id } = useParams();
  const formikRef = useRef<FormikProps<any>>(null);
  const { eventData, setEventData } = useEventContext();
  const auth = useSelector((state: RootState) => state.auth);
  const [isModalVisible, setModalVisible] = useState(false);
  const [formEditable, setFormEditable] = useState(true);
  const [modalMessage, setModalMessage] = useState("");
  
  useEffect (() => {
    if (eventData && eventData.status !== "defineScoringGuide") {
      setFormEditable(false);
    }
  }, [eventData]);

  const handleSubmit = async (values: any) => {
    try {
      console.log(`handleSubmit values: ${values}`);
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/event/create-scoring-guide`, {
        preEventId: eventData.id,
        meetingEventId: id,
        fieldOfKnowledge: values.fieldsOfKnowledge,
        taxonomyOfSkill: values.taxonomyOfSkills,
        attendanceToken: Number(values.attendanceToken),
        scoreTokenAmount: Number(values.learnerScoreToken),
        helpTokenAmount: Number(values.helpTokenAmount),
        instructorScoreToken: Number(values.instructorScoreToken),
      }, {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      });

      if (response.status === 201) {
        setModalMessage(response.data.message);
        setModalVisible(true);
        setFormEditable(false);
        
        // Refresh event data to get updated courseCreateStatus
        try {
          const eventResponse = await axios.get(`${import.meta.env.VITE_API_URL}/preevent/${eventData.id}`, {
            headers: {
              Authorization: `Bearer ${auth.accessToken}`,
            },
          });
          setEventData(eventResponse.data);
          console.log('[ScoringGuide] Event data refreshed after scoring guide creation');
        } catch (refreshError) {
          console.error('[ScoringGuide] Error refreshing event data:', refreshError);
        }
      }
    } catch (error) {
      console.error("Error adding scoring guide:", error);
      const errorMessage = error.response?.data?.message || 
                           error.response?.data?.error || 
                           error.message || 
                           'Failed to create scoring guide. Please try again.';
      setModalMessage(`Error: ${errorMessage}`);
      setModalVisible(true);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  // Guard: Don't render if eventData is not loaded yet
  if (!eventData) {
    return (
      <Container className="mt-4">
        <Card>
          <Card.Body>
            <div className="text-center">Loading event data...</div>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Formik
        initialValues={{
          organizer: eventData?.organizerName || "",
          community: eventData?.community || "",
          fieldsOfKnowledge: eventData?.fieldsOfKnowledge || "",
          taxonomyOfSkills: eventData?.taxonomyOfSkills || "",
          attendanceToken: eventData?.onlineEvent?.scoringGuide?.attendanceToken || 0,
          learnerScoreToken: eventData?.onlineEvent?.scoringGuide?.scoreTokenAmount || 0,
          helpTokenAmount: eventData?.onlineEvent?.scoringGuide?.helpTokenAmount || 0,
          instructorScoreToken: eventData?.onlineEvent?.scoringGuide?.instructorScoreToken || 0,
        }}
        validationSchema={validationSchema}
        innerRef={formikRef}
        onSubmit={handleSubmit}
      >
        {({ handleSubmit }) => (
          <Form onSubmit={handleSubmit}>
            <Card>
              <Card.Body>
                <Card.Title className="text-center mb-5"><strong>Scoring Guide</strong></Card.Title>
                <Card.Subtitle className="mb-3 text-muted text-center"><strong>Metadata</strong></Card.Subtitle>

                <div className="font-medium border-top pt-3 mb-3"><strong>Event ID: {id}</strong></div>

                {eventData && (
                  <div className="pt-3">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                         <div className="font-medium text-secondary"><strong>Institution:</strong> {eventData.organization}</div>
                         {eventData?.onlineEvent?.scoringGuide?.ipfsHash && (
                             <div className="text-end">
                                 <strong>IPFS Metadata: </strong>
                                 <a 
                                     href={`https://gateway.pinata.cloud/ipfs/${eventData.onlineEvent.scoringGuide.ipfsHash}`} 
                                     target="_blank" 
                                     rel="noopener noreferrer"
                                     className="text-primary text-decoration-none"
                                 >
                                     {eventData.onlineEvent.scoringGuide.ipfsHash.substring(0, 10)}...
                                     <i className="bi bi-box-arrow-up-right ms-1"></i>
                                 </a>
                             </div>
                         )}
                    </div>

                    <Row className="g-3 mb-4">
                      <Col md={6}>
                        <TextInput
                          name="community"
                          type="text"
                          label="Community"
                          containerStyle={`w-100`}
                          disabled={!formEditable}
                        />
                      </Col>
                      <Col md={6}>
                        <TextInput
                          name="organizer"
                          type="text"
                          label="Organizer"
                          containerStyle={`w-100`}
                          disabled={!formEditable}
                        />
                      </Col>
                    </Row>

                    {eventData.speakersName && Array.isArray(eventData.speakersName) && eventData.speakersName.length > 0 && (
                      <div className="mb-4">
                          <strong className="text-secondary">Instructors:</strong> {eventData.speakersName.join(", ")}
                      </div>
                    )}

                    <Row className="g-3">
                      <Col md={6}>
                        <TextInput
                          name="fieldsOfKnowledge"
                          type="text"
                          label="Fields of Knowledge"
                          containerStyle={`w-100`}
                          disabled={!formEditable}
                        />
                      </Col>
                      <Col md={6}>
                        <TextInput
                          name="taxonomyOfSkills"
                          type="text"
                          label="Taxonomy of Skills"
                          containerStyle={`w-100`}
                          disabled={!formEditable}
                        />
                      </Col>
                    </Row>
                    
                    {eventData?.onlineEvent?.scoringGuide?.scoringGuide && (
                        <div className="mt-4 text-end border-top pt-3">
                            <Button 
                                variant="outline-dark" 
                                size="sm"
                                onClick={() => {
                                    const jsonString = JSON.stringify(eventData.onlineEvent.scoringGuide.scoringGuide, null, 2);
                                    const blob = new Blob([jsonString], { type: "application/json" });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement("a");
                                    link.href = url;
                                    link.download = `LMS_Data_${eventData.meetingEventId}.json`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                            >
                                <i className="bi bi-download me-2"></i>
                                Download Full LMS Data (JSON)
                            </Button>
                        </div>
                    )}
                  </div>
                )}

                <div className="border-top border-bottom my-4">
                  <div className="font-medium text-center mt-2 mb-2">
                    <strong>Token Creation and Distribution</strong>
                  </div>
                </div>

                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th className="text-center">Type of Tokens</th>
                      <th className="text-center">Number of Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Attendance Token</td>
                      <td>
                        <TextInput
                          name="attendanceToken"
                          type="number"
                          containerStyle={`w-100`}
                          disabled={!formEditable}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="text-center">Learner Score Token</td>
                      <td>
                        <TextInput
                          name="learnerScoreToken"
                          type="number"
                          containerStyle={`w-100`}
                          disabled={!formEditable}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="text-center">Help Token for Learners</td>
                      <td>
                        <TextInput
                          name="helpTokenAmount"
                          type="number"
                          containerStyle={`w-100`}
                          disabled={!formEditable}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="text-center">Instructor Score Token</td>
                      <td>
                        <TextInput
                          name="instructorScoreToken"
                          type="number"
                          containerStyle={`w-100`}
                          disabled={!formEditable}
                        />
                      </td>
                    </tr>
                  </tbody>
                </Table>

              </Card.Body>
            </Card>

            {eventData && eventData.status === "defineScoringGuide" && formEditable && (
              <Button
                size="sm"
                className="w-100 mt-3"
                variant="btn btn-outline-primary"
                type="submit"
              >
                Add Scoring Guide
              </Button>
            )}

          </Form>
        )}
      </Formik>

      <SuccessModal show={isModalVisible} message={modalMessage} onClose={closeModal} />  

    </Container>
  );
};

export default ScoringGuide;
