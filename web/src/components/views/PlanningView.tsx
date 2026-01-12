import AddItemInput from './AddItemInput';
import CategoryList from './CategoryList';

const PlanningView = () => {
    return (
        <div className="animate-fade-in relative z-20">
            <AddItemInput />
            <CategoryList />
        </div>
    );
};

export default PlanningView;
