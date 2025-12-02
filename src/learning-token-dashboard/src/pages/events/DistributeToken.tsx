import { Form, Formik, FormikProps } from "formik";
import { useEffect, useRef, useState } from "react";
import { array, number, object, string } from "yup";
import SelectInput from "../../components/SelectInput";
import { Container, Card, Button, FormGroup } from "react-bootstrap";
import { useEventContext } from "../../contexts/EventContext";
import { SuccessModal } from "../../components/Modal/SuccessModal";
import { SmartcontractFunctionsEnum } from "../../enums/smartcontract-functions.enum";
import axios from "axios";
import { RootState } from "../../store";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";

const initialValues = {
  token_type: "attendance_token",
  attendance: null,
};

const validationSchema = object().shape({
  token_type: string().required("Please select an institution"),
  attendance: array()
    .of(
      object().shape({
        courseId: number(),
        amount: number(),
        learnerId: number(),
        fieldOfKnowledge: string(),
        skillName: string(),
      })
    )
    .required("At least 1 attendance should be added"),
});
const DistributeToken = () => {
  const { id } = useParams();
  const formikRef = useRef<FormikProps<any>>(null);
  const { eventData, setEventData } = useEventContext();
  const [isModalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const auth = useSelector((state: RootState) => state.auth);
  const [learnersList, setLearnersList] = useState([]);
  const [filteredLearnersList, setFilteredLearnersList] = useState([]);
  const [selectedLearners, setSelectedLearners] = useState<Record<number, boolean>>({});
  const [allSelected, setAllSelected] = useState(false);
  const [courseCreated, setCourseCreated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch Event Data (Always fetch to ensure fresh status)
  useEffect(() => {
    const fetchEventData = async () => {
      if (id) {
        try {
          // Only show loading if we don't have data yet, or if we want to ensure strict freshness
          if (!eventData) setIsLoading(true);
          
          console.log(`[DistributeToken] Fetching fresh event data for ID: ${id}`);
          const response = await axios.get(`${import.meta.env.VITE_API_URL}/event/${id}`, {
            headers: {
              Authorization: `Bearer ${auth.accessToken}`,
            },
          });
          console.log('[DistributeToken] Event data fetched:', response.data);
          setEventData(response.data);
        } catch (error) {
          console.error("[DistributeToken] Error fetching event data:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchEventData();
  }, [id, auth.accessToken, setEventData]);

  // 2. Fetch Learners and Event Details (Depends on eventData)
  useEffect(() => {
    const fetchEventAndLearners = async () => {
      // Guard: Only proceed if we have a numeric ID from eventData
      if (!eventData?.id) {
        if (id && !eventData) {
           // If we have URL ID but no eventData yet, keep loading true (waiting for fetchEventData)
           return;
        }
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Check if course was created on-chain
        // We use eventData directly as it should be populated now
        const courseCreateStatus = eventData?.onlineEvent?.courseCreateStatus;
        setCourseCreated(!!courseCreateStatus);

        // Fetch learners list (Admin)
        const learnersResponse = await axios.get(`${import.meta.env.VITE_API_URL}/admin/learner-list`, {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        });

        const allLearners = learnersResponse?.data?.result?.data || [];
        setLearnersList(allLearners);
        
        // Fetch event attendees (Postevent) using numeric ID
        console.log(`[DistributeToken] Fetching post-events for event ID: ${eventData.id}`);
        const posteventResponse = await axios.get(`${import.meta.env.VITE_API_URL}/postevent/${eventData.id}`);
        const eventLearnersEmails = posteventResponse.data.map((learner: any) => learner.email);

        // Filter learnersList by the emails fetched from the event
        const filteredLearners = allLearners.filter((learner: any) =>
          eventLearnersEmails.includes(learner.email)
        );

        setFilteredLearnersList(filteredLearners);
      } catch (error) {
        console.error("Error fetching event and learners list:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventAndLearners();
  }, [eventData, auth.accessToken, id]); // Depend on eventData (deep check or key properties)

  useEffect(() => {
    // Update selectedLearners based on allSelected
    const updatedSelected = {};
    filteredLearnersList.forEach(learner => {
      updatedSelected[learner.id] = allSelected;
    });
    setSelectedLearners(updatedSelected);
  }, [allSelected, filteredLearnersList]);

  const handleCheckboxChange = (learnerId: number) => {
    console.log("Checkbox changed for learner:", learnerId);

    setSelectedLearners((prev) => ({
      ...prev,
      [learnerId]: !prev[learnerId],
    }));
  }

  const handleSelectAllChange = () => {
    setAllSelected(!allSelected);
  }

  const handleSubmit = async (values: any) => {
    // Check if course was created before allowing distribution
    if (!courseCreated) {
      setModalMessage('Error: Course must be created on-chain before distributing tokens. Please go back to "Review Wallets" step and click "Create Course" button first.');
      setModalVisible(true);
      return;
    }

    console.log("Form Submitted with values:", values);

    const hasSelectedLearners = Object.values(selectedLearners).some((selected) => selected);
    let submitSelectedLearnerList = null
    if (hasSelectedLearners) {
      submitSelectedLearnerList = Object.keys(selectedLearners)
        .filter((learner) => selectedLearners[learner])
        .map((learner) => (Number(learner)));
    } else { // If no learners are selected, submit all learners
      submitSelectedLearnerList = filteredLearnersList.map((learner) => learner.id);
    }

    if (!submitSelectedLearnerList || submitSelectedLearnerList.length === 0) {
      setModalMessage('Error: Please select at least one learner to distribute tokens to.');
      setModalVisible(true);
      return;
    }

    values.learnersList = submitSelectedLearnerList;

    let functionName = "";
    switch (values.token_type) {
      case "attendance_token":
        functionName = SmartcontractFunctionsEnum.BATCH_MINT_ATTENDANCE_TOKEN;
        break;
      case "score_token":
        functionName = SmartcontractFunctionsEnum.BATCH_MINT_SCORE_TOKEN;
        break;
      case "instructorScore_token":
        functionName = SmartcontractFunctionsEnum.BATCH_MINT_INSTRUCTOR_SCORE_TOKEN;
        break;
      default:
        setModalMessage('Error: Please select a valid token type.');
        setModalVisible(true);
        return;
    }

    console.log(`selectedLearnerList: ${values.learnersList}`);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/smartcontract/token-distributions`, {
        functionName: functionName,
        preEventId: eventData.id,
        userIds: values.learnersList,
      }, {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      });

      if (response.status === 201) {
        const message = response.data.message || 'Tokens distributed successfully';
        setModalMessage(message);
        setModalVisible(true);
      }
    } catch (error: any) {
      console.error("Error distributing tokens:", error);
      const errorMessage = error.response?.data?.message || 
                           error.response?.data?.error || 
                           error.message || 
                           'Failed to distribute tokens. Please try again.';
      setModalMessage(`Error: ${errorMessage}`);
      setModalVisible(true);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const tokenType = [
    { value: "attendance_token", label: "Attendance Token" },
    // { value: "batch_attendance_token", label: "Batch Attendance Token" },
    // { value: "helping_token", label: "Helping Token" },
    // { value: "batch_helping_token", label: "Batch Helping Token" },
    { value: "score_token", label: "Score Token" },
    // { value: "batch_score_token", label: "Batch Score Token" },
    { value: "instructorScore_token", label: "Instructor Score Token" },
    // {
    //   value: "batch_instructorScore_token",
    //   label: "Batch Instructor Score Token",
    // },
  ];

  if (isLoading) {
    return (
      <Container className="my-4">
        <Card className="p-4" style={{ width: '600px', margin: 'auto' }}>
          <Card.Body>
            <div className="text-center">Loading...</div>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  if (!courseCreated) {
    return (
      <Container className="my-4">
        <Card className="p-4" style={{ width: '600px', margin: 'auto' }}>
          <Card.Body>
            <div className="alert alert-warning" role="alert">
              <h5 className="alert-heading">Course Not Created</h5>
              <p>
                The course must be created on-chain before you can distribute tokens.
              </p>
              <hr />
              <p className="mb-0">
                Please go back to the <strong>"Review Wallets"</strong> step and click the <strong>"Create Course"</strong> button first.
              </p>
            </div>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="my-4">
      <Card className="p-4" style={{ width: '600px', margin: 'auto' }}>
        <Card.Body>
          <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            innerRef={formikRef}
            onSubmit={handleSubmit}
          >
            {({ values }) => (
              <Form>
                <FormGroup>
                  <h5>Token</h5>
                  <SelectInput
                    containerStyle={"w-100"}
                    size="small"
                    name="token_type"
                    options={tokenType}
                  />
                </FormGroup>

                <FormGroup>
                  <h5>Learners</h5>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      className="ml-2 mr-2"
                      type="checkbox"
                      id="select-all"
                      checked={allSelected}
                      onChange={handleSelectAllChange}
                    />
                    <label htmlFor="select-all">Select All</label>
                    <hr/>
                  </div>
                  {filteredLearnersList.map((learner) => (
                    <div key={learner.id} style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        className="ml-2 mr-2"
                        type="checkbox"
                        id={`learner-${learner.id}`}
                        checked={!!selectedLearners[learner.id]}
                        onChange={() => handleCheckboxChange(learner.id)}
                      />
                      <label htmlFor={`learner-${learner.id}`}>
                        {learner.name} - {learner.publicAddress}
                      </label>
                    </div>
                  ))}
                </FormGroup>

                <Button
                  size="sm"
                  className="w-100 mt-3"
                  variant="btn btn-outline-primary"
                  type="submit"
                  onClick={() => handleSubmit(values)}
                >
                  Distribute
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

export default DistributeToken;